import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { Client } from "../../entities/client.entity";

/** Una hora: el cumpleaños no necesita más precisión y el sondeo recorre fichas. */
const INTERVALO_POR_DEFECTO_MS = 3600000;

/** Fichas que se resuelven por ciclo; el resto espera al siguiente. */
const MAXIMO_POR_SONDEO = 500;

/** Cliente que cumple años hoy en la zona de su negocio. */
interface Cumpleanero {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  anio: number;
}

/**
 * Sondea las fichas y publica `core.client.birthday` el dia que el cliente
 * cumple anos en su zona. Se desactiva con CUMPLEANOS_ENABLED=false.
 */
@Injectable()
export class CumpleanosWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CumpleanosWorker.name);
  private readonly intervaloMs: number;
  private readonly activo: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private corriendo = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly configService: ConfigService
  ) {
    const crudo = Number(this.configService.get("CUMPLEANOS_INTERVAL_MS"));
    this.intervaloMs =
      Number.isFinite(crudo) && crudo > 0 ? crudo : INTERVALO_POR_DEFECTO_MS;
    this.activo =
      this.configService.get<string>("CUMPLEANOS_ENABLED") !== "false";
  }

  /** Arranca el sondeo periódico, salvo que esté desactivado por configuración. */
  onModuleInit(): void {
    if (!this.activo) {
      this.logger.warn(
        "Felicitaciones de cumpleaños deshabilitadas (CUMPLEANOS_ENABLED=false)"
      );
      return;
    }
    this.timer = setInterval(() => {
      this.sondear().catch((err: Error) => {
        this.logger.error(
          `Error inesperado en el sondeo de cumpleaños: ${err?.message}`,
          err?.stack
        );
      });
    }, this.intervaloMs);
    this.logger.log(
      `Felicitaciones de cumpleaños iniciadas (intervalo=${this.intervaloMs}ms)`
    );
  }

  /** Detiene el sondeo al parar el servicio. */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Felicita a quien cumple años hoy y todavía no ha sido felicitado este año. */
  async sondear(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      for (const cliente of await this.cumpleanerosDeHoy()) {
        await this.felicitar(cliente);
      }
    } finally {
      this.corriendo = false;
    }
  }

  /**
   * Fichas cuyo dia y mes de nacimiento coinciden con la fecha de hoy en la
   * zona del negocio, que aplica Postgres negocio a negocio.
   */
  private async cumpleanerosDeHoy(): Promise<Cumpleanero[]> {
    return this.dataSource.query(
      `
      SELECT c.id,
             c.business_id AS "businessId",
             c.name,
             c.email,
             EXTRACT(YEAR FROM (now() AT TIME ZONE b.timezone))::int AS anio
      FROM clients c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.birth_date IS NOT NULL
        AND c.active
        AND c.anonymized_at IS NULL
        AND EXTRACT(MONTH FROM c.birth_date)
            = EXTRACT(MONTH FROM (now() AT TIME ZONE b.timezone))
        AND EXTRACT(DAY FROM c.birth_date)
            = EXTRACT(DAY FROM (now() AT TIME ZONE b.timezone))
        AND (c.birthday_greeted_year IS NULL
             OR c.birthday_greeted_year
                <> EXTRACT(YEAR FROM (now() AT TIME ZONE b.timezone)))
      ORDER BY c.id
      LIMIT $1
      `,
      [MAXIMO_POR_SONDEO]
    );
  }

  /**
   * Marca el año y encola el evento en la misma transacción. Si el `UPDATE` no
   * afecta a ninguna fila, otra instancia se adelantó y no se emite nada.
   */
  private async felicitar(cliente: Cumpleanero): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const marcada = await manager
        .createQueryBuilder()
        .update(Client)
        .set({ birthdayGreetedYear: cliente.anio })
        .where("id = :id", { id: cliente.id })
        .andWhere(
          "(birthday_greeted_year IS NULL OR birthday_greeted_year <> :anio)",
          { anio: cliente.anio }
        )
        .execute();

      if (!marcada.affected) return;

      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_CLIENT_BIRTHDAY,
        aggregateType: "client",
        aggregateId: cliente.id,
        payload: {
          clientId: cliente.id,
          businessId: cliente.businessId,
          name: cliente.name,
          email: cliente.email ?? undefined,
          year: cliente.anio,
        },
      });
      this.logger.log(
        `Felicitación de cumpleaños para el cliente ${cliente.id}`
      );
    });
  }
}
