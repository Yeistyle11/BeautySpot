import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In, IsNull, Between } from "typeorm";
import { OutboxService, ZonaDelNegocioService } from "@beautyspot/nest-common";
import { instanteDe } from "@beautyspot/shared-utils";
import { EventNames } from "@beautyspot/event-types";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { Appointment } from "../../entities/appointment.entity";
import { serviciosDelEvento } from "../../common/servicios-del-evento";

const DEFAULT_POLL_INTERVAL_MS = 60000;

/** Citas que se traen a memoria por página, para no cargar las de toda la plataforma. */
const MAXIMO_POR_SONDEO = 1000;

/** Páginas por ciclo; el resto espera al siguiente en vez de alargar el sondeo. */
const MAXIMO_PAGINAS = 10;

/**
 * Cada recordatorio se dispara **por debajo** de su umbral, no dentro de una
 * franja: si el worker estuvo caído a las 24 h, el aviso sale en cuanto vuelve.
 * `minimo` es la antelación por debajo de la cual ese aviso ya no aporta —el de
 * 1 h lo releva, o la cita ya empezó— y se marca sin enviar nada.
 */
const VENTANAS = {
  "24h": { umbral: 24, minimo: 1, columna: "reminder24hSentAt" },
  "1h": { umbral: 1, minimo: 0, columna: "reminder1hSentAt" },
} as const;

type Ventana = keyof typeof VENTANAS;

/** Qué hacer con un recordatorio pendiente en este ciclo. */
type Decision = "esperar" | "emitir" | "descartar";

/**
 * Sondea las citas próximas y publica `booking.appointment.reminder-due` cuando
 * entran en el umbral de 24h o de 1h.
 *
 * Cada recordatorio se marca en la propia cita dentro de la misma transacción que
 * el evento del outbox, así que no se repite aunque haya varias instancias
 * sondeando a la vez. Se puede desactivar con REMINDERS_ENABLED=false.
 */
@Injectable()
export class RemindersWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersWorker.name);
  private readonly pollIntervalMs: number;
  private readonly enabled: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly zonas: ZonaDelNegocioService,
    private readonly configService: ConfigService
  ) {
    const raw = this.configService.get("REMINDERS_INTERVAL_MS");
    const parsed = Number(raw);
    this.pollIntervalMs =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_INTERVAL_MS;
    this.enabled =
      this.configService.get<string>("REMINDERS_ENABLED") !== "false";
  }

  /** Arranca el sondeo periódico, salvo que esté desactivado por configuración. */
  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn(
        "Recordatorios deshabilitados (REMINDERS_ENABLED=false)"
      );
      return;
    }
    this.timer = setInterval(() => {
      this.poll().catch((err: Error) => {
        this.logger.error(
          `Error inesperado en el sondeo de recordatorios: ${err?.message}`,
          err?.stack
        );
      });
    }, this.pollIntervalMs);
    this.logger.log(
      `Recordatorios de cita iniciados (intervalo=${this.pollIntervalMs}ms)`
    );
  }

  /** Detiene el sondeo al parar el servicio. */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Recorre las citas de los próximos días y resuelve las que tocan. */
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const ahora = new Date();
      // El rango se abre un día por cada lado del tramo que interesa: la fecha
      // de la cita es hora de pared de su negocio y aquí aún no se sabe en qué
      // huso está. El corte fino lo hace `decidir`, ya con la zona resuelta.
      const rango = Between(
        this.aFecha(this.sumarHoras(ahora, -24)),
        this.aFecha(this.sumarHoras(ahora, 48))
      );
      const estados = In([
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
      ]);
      // Descartar en la consulta las citas con ambos avisos ya enviados: es el
      // mismo predicado del índice parcial idx_appointments_recordatorios.
      const where = [
        { date: rango, status: estados, reminder24hSentAt: IsNull() },
        { date: rango, status: estados, reminder1hSentAt: IsNull() },
      ];

      for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
        const candidatas = await this.dataSource
          .getRepository(Appointment)
          .find({
            where,
            // Los servicios viajan en el evento para que el correo nombre lo
            // que se reservó y no un genérico "Servicio".
            relations: { appointmentServices: true },
            order: { date: "ASC", startTime: "ASC" },
            take: MAXIMO_POR_SONDEO,
            skip: pagina * MAXIMO_POR_SONDEO,
          });

        for (const cita of candidatas) {
          await this.resolver(cita, ahora);
        }

        if (candidatas.length < MAXIMO_POR_SONDEO) return;
      }

      this.logger.warn(
        `El sondeo agotó sus ${MAXIMO_PAGINAS} páginas; el resto se atenderá en el siguiente ciclo`
      );
    } finally {
      this.running = false;
    }
  }

  /** Aplica a una cita lo que toque en cada uno de sus recordatorios pendientes. */
  private async resolver(cita: Appointment, ahora: Date): Promise<void> {
    const zona = await this.zonas.de(cita.businessId);
    const inicio = instanteDe(zona, cita.date, cita.startTime);
    const faltan = (inicio.getTime() - ahora.getTime()) / 3600000;
    const antelacion =
      (inicio.getTime() - new Date(cita.createdAt).getTime()) / 3600000;

    for (const ventana of Object.keys(VENTANAS) as Ventana[]) {
      if (cita[VENTANAS[ventana].columna]) continue;

      const decision = this.decidir(ventana, faltan, antelacion);
      if (decision === "esperar") continue;
      await this.marcar(cita, ventana, decision === "emitir");
    }
  }

  /** Decide qué hacer con un recordatorio según lo que falta para la cita. */
  private decidir(
    ventana: Ventana,
    faltan: number,
    antelacion: number
  ): Decision {
    const { umbral, minimo } = VENTANAS[ventana];

    if (faltan > umbral) return "esperar";
    // Reservada cuando el umbral ya había pasado: el cliente acaba de elegir esa
    // hora y recordársela no aporta nada.
    if (antelacion <= umbral) return "descartar";
    return faltan > minimo ? "emitir" : "descartar";
  }

  /**
   * Marca el recordatorio y, si toca avisar, encola el evento en la misma
   * transacción. Los descartados se marcan igual, para no reevaluarlos cada
   * ciclo mientras la cita siga en el rango.
   */
  private async marcar(
    cita: Appointment,
    ventana: Ventana,
    avisar: boolean
  ): Promise<void> {
    const columna = VENTANAS[ventana].columna;
    await this.dataSource.transaction(async (manager) => {
      const marcada = await manager.update(
        Appointment,
        { id: cita.id, [columna]: IsNull() },
        { [columna]: new Date() }
      );
      // Otra instancia se adelantó y ya lo marcó.
      if (!marcada.affected) return;
      if (!avisar) return;

      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_REMINDER_DUE,
        aggregateType: "appointment",
        aggregateId: cita.id,
        payload: {
          appointmentId: cita.id,
          businessId: cita.businessId,
          clientId: cita.clientId,
          professionalId: cita.professionalId,
          date: cita.date,
          startTime: cita.startTime,
          endTime: cita.endTime,
          totalAmount: cita.totalAmount,
          services: serviciosDelEvento(cita.appointmentServices),
          reminderType: ventana,
        },
      });
      this.logger.log(`Recordatorio de ${ventana} para la cita ${cita.id}`);
    });
  }

  /** Devuelve la fecha desplazada las horas indicadas. */
  private sumarHoras(fecha: Date, horas: number): Date {
    return new Date(fecha.getTime() + horas * 3600000);
  }

  /** Formatea la fecha local como YYYY-MM-DD, que es como se guarda la cita. */
  private aFecha(fecha: Date): string {
    const mes = `${fecha.getMonth() + 1}`.padStart(2, "0");
    const dia = `${fecha.getDate()}`.padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}
