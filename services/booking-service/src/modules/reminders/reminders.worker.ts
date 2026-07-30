import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In, IsNull, Between } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { Appointment } from "../../entities/appointment.entity";

const DEFAULT_POLL_INTERVAL_MS = 60000;

/** Citas que se examinan por sondeo, para no traer a memoria las de toda la plataforma. */
const MAXIMO_POR_SONDEO = 1000;

/** Ventana horaria (en horas antes de la cita) que dispara cada recordatorio. */
const VENTANAS = {
  "24h": { desde: 23, hasta: 25, columna: "reminder24hSentAt" },
  "1h": { desde: 0.5, hasta: 1.5, columna: "reminder1hSentAt" },
} as const;

type Ventana = keyof typeof VENTANAS;

/**
 * Sondea las citas próximas y publica `booking.appointment.reminder-due` cuando
 * entran en la ventana de 24h o de 1h.
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

  /** Recorre las citas de los próximos dos días y publica las que tocan. */
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const ahora = new Date();
      const rango = Between(
        this.aFecha(ahora),
        this.aFecha(this.sumarHoras(ahora, 26))
      );
      const estados = In([
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
      ]);
      // Descartar en la consulta las citas con ambos avisos ya enviados: es el
      // mismo predicado del índice parcial idx_appointments_recordatorios.
      const candidatas = await this.dataSource.getRepository(Appointment).find({
        where: [
          { date: rango, status: estados, reminder24hSentAt: IsNull() },
          { date: rango, status: estados, reminder1hSentAt: IsNull() },
        ],
        order: { date: "ASC", startTime: "ASC" },
        take: MAXIMO_POR_SONDEO,
      });

      if (candidatas.length === MAXIMO_POR_SONDEO) {
        this.logger.warn(
          `El sondeo alcanzó el tope de ${MAXIMO_POR_SONDEO} citas; las restantes se atenderán en el siguiente ciclo`
        );
      }

      for (const cita of candidatas) {
        const ventana = this.ventanaDe(cita, ahora);
        if (!ventana) continue;
        if (cita[VENTANAS[ventana].columna]) continue;
        await this.publicar(cita, ventana);
      }
    } finally {
      this.running = false;
    }
  }

  /** Devuelve la ventana en la que cae la cita, o null si aún no toca recordarla. */
  private ventanaDe(cita: Appointment, ahora: Date): Ventana | null {
    const inicio = new Date(`${cita.date}T${cita.startTime}`);
    const horas = (inicio.getTime() - ahora.getTime()) / 3600000;
    for (const [nombre, ventana] of Object.entries(VENTANAS)) {
      if (horas >= ventana.desde && horas <= ventana.hasta) {
        return nombre as Ventana;
      }
    }
    return null;
  }

  /** Marca el recordatorio y encola el evento en la misma transacción. */
  private async publicar(cita: Appointment, ventana: Ventana): Promise<void> {
    const columna = VENTANAS[ventana].columna;
    await this.dataSource.transaction(async (manager) => {
      const marcada = await manager.update(
        Appointment,
        { id: cita.id, [columna]: IsNull() },
        { [columna]: new Date() }
      );
      // Otra instancia se adelantó y ya lo marcó.
      if (!marcada.affected) return;

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
