import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In, LessThan, Repository } from "typeorm";
import { EVENTOS_CON_SECRETO } from "@beautyspot/event-types";
import { EventBusService } from "../event-bus/event-bus.service";
import { OutboxMessageEntity, OutboxStatus } from "./outbox-message.entity";

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_RETENTION_DAYS = 7;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
/** Cada cuántos sondeos se purgan los mensajes ya publicados. */
const SONDEOS_ENTRE_PURGAS = 300;
/** Lotes como mucho en un sondeo, para no monopolizar el pool con un atasco. */
const MAXIMO_LOTES_POR_SONDEO = 20;
/** Espera tras el primer fallo; se dobla en cada intento hasta el tope. */
const RETRASO_BASE_MS = 5000;
const RETRASO_MAXIMO_MS = 5 * 60 * 1000;

/** Cómo terminó la publicación de un mensaje del lote. */
interface ResultadoDePublicacion {
  mensaje: OutboxMessageEntity;
  error?: string;
}

/** Los campos que se escriben al anotar el desenlace de un mensaje. */
type CambiosDeMensaje = Parameters<
  Repository<OutboxMessageEntity>["update"]
>[1];

/**
 * Sondea periódicamente la tabla outbox y publica en RabbitMQ los eventos pendientes.
 *
 * Reclama lotes con bloqueo pesimista y `SKIP LOCKED` para que varias instancias
 * puedan procesar en paralelo sin pisarse. Cada evento se reintenta hasta
 * `OUTBOX_MAX_ATTEMPTS`; superado el límite queda marcado como DEAD para revisión.
 * Se puede desactivar con OUTBOX_RELAY_ENABLED=false.
 */
@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly concurrency: number;
  private readonly retentionDays: number;
  private readonly enabled: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private sondeosDesdePurga = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService
  ) {
    this.pollIntervalMs = this.getNumberConfig(
      "OUTBOX_RELAY_INTERVAL_MS",
      DEFAULT_POLL_INTERVAL_MS
    );
    this.batchSize = this.getNumberConfig(
      "OUTBOX_RELAY_BATCH_SIZE",
      DEFAULT_BATCH_SIZE
    );
    this.maxAttempts = this.getNumberConfig(
      "OUTBOX_MAX_ATTEMPTS",
      DEFAULT_MAX_ATTEMPTS
    );
    this.concurrency = this.getNumberConfig(
      "OUTBOX_RELAY_CONCURRENCY",
      DEFAULT_CONCURRENCY
    );
    this.retentionDays = this.getNumberConfig(
      "OUTBOX_RETENTION_DAYS",
      DEFAULT_RETENTION_DAYS
    );
    this.enabled =
      this.configService.get<string>("OUTBOX_RELAY_ENABLED") !== "false";
  }

  /** Arranca el sondeo periódico, salvo que esté desactivado por configuración. */
  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn(
        "Outbox relay deshabilitado (OUTBOX_RELAY_ENABLED=false)"
      );
      return;
    }
    this.timer = setInterval(() => {
      this.poll().catch((err: Error) => {
        this.logger.error(
          `Error inesperado en poll del outbox: ${err?.message}`,
          err?.stack
        );
      });
    }, this.pollIntervalMs);
    this.logger.log(
      `Outbox relay iniciado (intervalo=${this.pollIntervalMs}ms, batch=${this.batchSize}, maxIntentos=${this.maxAttempts})`
    );
  }

  /** Detiene el sondeo al parar el servicio. */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Reclama lotes de eventos pendientes y los publica; encadena lotes mientras
   * salgan llenos, hasta el tope del sondeo. Un atasco grande se drena en
   * varios ciclos en vez de retener las conexiones en uno solo.
   */
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.purgarSiToca();

      for (let lote = 0; lote < MAXIMO_LOTES_POR_SONDEO; lote++) {
        const claimed = await this.claimBatch();
        if (claimed.length === 0) return;
        await this.publicarEnParalelo(claimed);
        if (claimed.length < this.batchSize) return;
      }

      this.logger.warn(
        `El sondeo agotó sus ${MAXIMO_LOTES_POR_SONDEO} lotes; el resto se publica en el siguiente ciclo`
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Borra cada varios sondeos los mensajes ya publicados que superan la
   * retención.
   */
  private async purgarSiToca(): Promise<void> {
    if (this.sondeosDesdePurga++ < SONDEOS_ENTRE_PURGAS) return;
    this.sondeosDesdePurga = 0;

    const limite = new Date(Date.now() - this.retentionDays * MS_POR_DIA);
    try {
      const { affected } = await this.dataSource
        .getRepository(OutboxMessageEntity)
        .delete({
          status: OutboxStatus.PROCESSED,
          processedAt: LessThan(limite),
        });
      if (affected) {
        this.logger.log(`Outbox: purgados ${affected} mensajes ya publicados`);
      }
    } catch (error: unknown) {
      // La purga es mantenimiento: si falla, el relay debe seguir publicando.
      this.logger.warn(
        `No se pudo purgar el outbox: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Toma en exclusiva un lote de pendientes y les suma un intento. */
  private async claimBatch(): Promise<OutboxMessageEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutboxMessageEntity);
      const rows = await repo
        .createQueryBuilder("o")
        .where("o.status = :status", { status: OutboxStatus.PENDING })
        .andWhere("o.attempts < :max", { max: this.maxAttempts })
        // Los que fallaron esperan su turno; los que nunca fallaron no tienen.
        .andWhere("(o.nextAttemptAt IS NULL OR o.nextAttemptAt <= :ahora)", {
          ahora: new Date(),
        })
        .orderBy("o.createdAt", "ASC")
        .take(this.batchSize)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();

      if (rows.length === 0) return [];

      // Un solo UPDATE para todo el lote, dentro de la transacción que
      // mantiene el bloqueo.
      await repo.increment({ id: In(rows.map((r) => r.id)) }, "attempts", 1);
      for (const row of rows) {
        row.attempts += 1;
      }
      return rows;
    });
  }

  /** Publica el lote en tramos, con varias publicaciones en vuelo a la vez. */
  private async publicarEnParalelo(
    mensajes: OutboxMessageEntity[]
  ): Promise<void> {
    const resultados: ResultadoDePublicacion[] = [];
    for (let i = 0; i < mensajes.length; i += this.concurrency) {
      const tramo = mensajes.slice(i, i + this.concurrency);
      resultados.push(
        ...(await Promise.all(
          tramo.map((mensaje) => this.publicarUno(mensaje))
        ))
      );
    }
    await this.anotarResultados(resultados);
  }

  /** Publica un evento y cuenta cómo fue, sin tocar todavía la base. */
  private async publicarUno(
    message: OutboxMessageEntity
  ): Promise<ResultadoDePublicacion> {
    try {
      // El id de la fila identifica el evento y se repite en cada reintento.
      await this.eventBus.emit(message.eventType, message.payload, {
        eventId: message.id,
        correlationId: message.aggregateId,
      });
      return { mensaje: message };
    } catch (error: unknown) {
      return {
        mensaje: message,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Escribe el desenlace de todo el lote: publicados, a la espera de otro
   * intento y muertos. Los mensajes se agrupan por el cambio que reciben, así
   * que el caso corriente —todos bien, o todos mal por la misma razón— es un
   * UPDATE y no uno por mensaje.
   */
  private async anotarResultados(
    resultados: ResultadoDePublicacion[]
  ): Promise<void> {
    const repo = this.dataSource.getRepository(OutboxMessageEntity);
    const ahora = new Date();
    const aBorrar: string[] = [];
    const grupos = new Map<
      string,
      { cambios: CambiosDeMensaje; ids: string[] }
    >();

    /** Suma el mensaje al grupo de los que reciben exactamente ese cambio. */
    const agrupar = (cambios: CambiosDeMensaje, id: string): void => {
      const clave = JSON.stringify(cambios);
      const grupo = grupos.get(clave) ?? { cambios, ids: [] };
      grupo.ids.push(id);
      grupos.set(clave, grupo);
    };

    for (const { mensaje, error } of resultados) {
      if (error === undefined) {
        // Los que llevan un secreto se borran en vez de marcarse: entregado el
        // enlace, conservar la fila hasta la purga dejaría el secreto legible
        // en la base durante días, mucho más de lo que vive el propio enlace.
        if (EVENTOS_CON_SECRETO.includes(mensaje.eventType)) {
          aBorrar.push(mensaje.id);
          continue;
        }
        agrupar(
          {
            status: OutboxStatus.PROCESSED,
            processedAt: ahora,
            lastError: null,
          },
          mensaje.id
        );
        continue;
      }

      if (mensaje.attempts >= this.maxAttempts) {
        agrupar(
          {
            status: OutboxStatus.DEAD,
            lastError: error,
            // Un mensaje muerto se queda para que alguien lo mire, y el secreto
            // de uno que nunca llegó a entregarse no debe quedarse con él.
            ...(EVENTOS_CON_SECRETO.includes(mensaje.eventType)
              ? { payload: {} }
              : {}),
          },
          mensaje.id
        );
        this.logger.error(
          `Outbox message ${mensaje.id} marcado DEAD tras ${mensaje.attempts} intentos: ${error}`
        );
        continue;
      }

      const proximo = this.proximoIntento(mensaje.attempts, ahora);
      agrupar(
        {
          status: OutboxStatus.PENDING,
          lastError: error,
          nextAttemptAt: proximo,
        },
        mensaje.id
      );
      this.logger.warn(
        `Outbox message ${mensaje.id} falló (intento ${mensaje.attempts}/${this.maxAttempts}), se reintenta a las ${proximo.toISOString()}: ${error}`
      );
    }

    if (aBorrar.length > 0) {
      await repo.delete({ id: In(aBorrar) });
    }
    for (const { cambios, ids } of grupos.values()) {
      await repo.update({ id: In(ids) }, cambios);
    }
  }

  /**
   * Cuándo puede volver a intentarse un mensaje que acaba de fallar: la espera
   * se dobla en cada intento hasta el tope. Sin ella, una caída de la cola
   * consume los cinco intentos en unos segundos y da por muertos eventos que
   * solo necesitaban esperar a que volviera.
   */
  private proximoIntento(intentos: number, ahora: Date): Date {
    const espera = Math.min(
      RETRASO_BASE_MS * 2 ** Math.max(0, intentos - 1),
      RETRASO_MAXIMO_MS
    );
    return new Date(ahora.getTime() + espera);
  }

  /** Lee un número de la configuración, con valor por defecto si falta o no es válido. */
  private getNumberConfig(key: string, fallback: number): number {
    const raw = this.configService.get(key);
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
