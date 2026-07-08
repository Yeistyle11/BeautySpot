import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EventBusService } from "../event-bus/event-bus.service";
import { OutboxMessageEntity, OutboxStatus } from "./outbox-message.entity";

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_ATTEMPTS = 5;

@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly enabled: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

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
    this.enabled =
      this.configService.get<string>("OUTBOX_RELAY_ENABLED") !== "false";
  }

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

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const claimed = await this.claimBatch();
      if (claimed.length === 0) return;
      for (const message of claimed) {
        await this.processOne(message);
      }
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(): Promise<OutboxMessageEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutboxMessageEntity);
      const rows = await repo
        .createQueryBuilder("o")
        .where("o.status = :status", { status: OutboxStatus.PENDING })
        .andWhere("o.attempts < :max", { max: this.maxAttempts })
        .orderBy("o.createdAt", "ASC")
        .take(this.batchSize)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();

      if (rows.length === 0) return [];

      for (const row of rows) {
        row.attempts += 1;
      }
      await repo.save(rows);
      return rows;
    });
  }

  private async processOne(message: OutboxMessageEntity): Promise<void> {
    try {
      await this.eventBus.emit(
        message.eventType,
        message.payload,
        message.aggregateId
      );
      await this.markProcessed(message.id);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.markFailed(message, errorMessage);
    }
  }

  private async markProcessed(id: string): Promise<void> {
    await this.dataSource.getRepository(OutboxMessageEntity).update(id, {
      status: OutboxStatus.PROCESSED,
      processedAt: new Date(),
      lastError: null,
    });
  }

  private async markFailed(
    message: OutboxMessageEntity,
    errorMessage: string
  ): Promise<void> {
    const repo = this.dataSource.getRepository(OutboxMessageEntity);
    if (message.attempts >= this.maxAttempts) {
      await repo.update(message.id, {
        status: OutboxStatus.DEAD,
        lastError: errorMessage,
      });
      this.logger.error(
        `Outbox message ${message.id} marcado DEAD tras ${message.attempts} intentos: ${errorMessage}`
      );
    } else {
      await repo.update(message.id, {
        status: OutboxStatus.PENDING,
        lastError: errorMessage,
      });
      this.logger.warn(
        `Outbox message ${message.id} falló (intento ${message.attempts}/${this.maxAttempts}): ${errorMessage}`
      );
    }
  }

  private getNumberConfig(key: string, fallback: number): number {
    const raw = this.configService.get(key);
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
