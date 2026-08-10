import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { NegocioMetricsService } from "./negocio-metrics.service";

const INTERVALO_POR_DEFECTO_MS = 60 * 60 * 1000;

/** Capacidad de un profesional, tal como la devuelve booking. */
interface CapacidadDeProfesional {
  professionalId: string;
  minutosDisponibles: number;
}

/** Materializa cada hora los minutos disponibles de cada profesional. */
@Injectable()
export class CapacidadWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CapacidadWorker.name);
  private readonly intervalMs: number;
  private readonly enabled: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly http: InternalHttpClient,
    private readonly metrics: NegocioMetricsService,
    configService: ConfigService
  ) {
    const raw = Number(configService.get("CAPACIDAD_INTERVAL_MS"));
    this.intervalMs =
      Number.isFinite(raw) && raw > 0 ? raw : INTERVALO_POR_DEFECTO_MS;
    this.enabled = configService.get<string>("CAPACIDAD_ENABLED") !== "false";
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn("Capacidad deshabilitada (CAPACIDAD_ENABLED=false)");
      return;
    }
    this.timer = setInterval(() => {
      this.materializar().catch((err: Error) => {
        this.logger.error(
          `Error al materializar la capacidad: ${err?.message}`,
          err?.stack
        );
      });
    }, this.intervalMs);
    this.logger.log(`Capacidad de agenda iniciada (cada ${this.intervalMs}ms)`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Pide a booking la capacidad de hoy de cada negocio con actividad y la guarda. */
  async materializar(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const {
        business_id: businessId,
        date,
      } of await this.diasAbiertos()) {
        const capacidad = await this.http.pedirONulo<CapacidadDeProfesional[]>(
          "booking",
          `/internal/appointments/capacidad?businessId=${businessId}&date=${date}`
        );
        if (!Array.isArray(capacidad)) continue;

        for (const { professionalId, minutosDisponibles } of capacidad) {
          await this.metrics.fijarCapacidad(
            businessId,
            professionalId,
            date,
            minutosDisponibles
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Negocios y días con movimiento en la última semana. */
  private async diasAbiertos(): Promise<
    { business_id: string; date: string }[]
  > {
    return (await this.dataSource.query(
      `SELECT DISTINCT business_id, date
       FROM daily_metrics
       WHERE date >= CURRENT_DATE - INTERVAL '7 days'`
    )) as { business_id: string; date: string }[];
  }
}
