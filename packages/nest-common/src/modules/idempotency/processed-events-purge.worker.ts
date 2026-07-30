import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, LessThan } from "typeorm";
import { ProcessedEventEntity } from "./processed-event.entity";

/**
 * Días que se conserva la marca de un evento ya aplicado: cubre con margen la
 * ventana en la que RabbitMQ puede reentregarlo.
 */
const RETENCION_POR_DEFECTO_DIAS = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const INTERVALO_POR_DEFECTO_MS = 6 * 60 * 60 * 1000;

/**
 * Borra periódicamente las marcas de eventos ya aplicados que superan la
 * retención. Se desactiva con PROCESSED_EVENTS_PURGE_ENABLED=false.
 */
@Injectable()
export class ProcessedEventsPurgeWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProcessedEventsPurgeWorker.name);
  private readonly retencionDias: number;
  private readonly intervaloMs: number;
  private readonly habilitado: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {
    this.retencionDias = this.numero(
      "PROCESSED_EVENTS_RETENTION_DAYS",
      RETENCION_POR_DEFECTO_DIAS
    );
    this.intervaloMs = this.numero(
      "PROCESSED_EVENTS_PURGE_INTERVAL_MS",
      INTERVALO_POR_DEFECTO_MS
    );
    this.habilitado =
      this.configService.get<string>("PROCESSED_EVENTS_PURGE_ENABLED") !==
      "false";
  }

  /** Programa la purga periódica, salvo que esté desactivada por configuración. */
  onModuleInit(): void {
    if (!this.habilitado) return;
    this.timer = setInterval(() => {
      this.purgar().catch((error: Error) => {
        this.logger.error(
          `Error inesperado purgando eventos procesados: ${error?.message}`,
          error?.stack
        );
      });
    }, this.intervaloMs);
    // No debe mantener vivo el proceso si no queda nada más que hacer.
    this.timer.unref?.();
  }

  /** Detiene la purga al parar el servicio. */
  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Borra las marcas anteriores al límite de retención. */
  async purgar(): Promise<number> {
    const limite = new Date(Date.now() - this.retencionDias * MS_POR_DIA);

    try {
      const { affected } = await this.dataSource
        .getRepository(ProcessedEventEntity)
        .delete({ processedAt: LessThan(limite) });

      if (affected) {
        this.logger.log(`Purgadas ${affected} marcas de eventos procesados`);
      }
      return affected ?? 0;
    } catch (error: unknown) {
      // La purga es mantenimiento: si falla, el consumo de eventos sigue.
      this.logger.warn(
        `No se pudieron purgar los eventos procesados: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 0;
    }
  }

  /** Lee un número de la configuración, con valor por defecto si falta o no es válido. */
  private numero(clave: string, porDefecto: number): number {
    const crudo = this.configService.get(clave);
    if (crudo === undefined || crudo === null || crudo === "")
      return porDefecto;
    const valor = Number(crudo);
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
  }
}
