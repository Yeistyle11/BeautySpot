import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisCacheService } from "../../cache/redis-cache.service";
import { EventBusService } from "../event-bus/event-bus.service";

/** Estado de una dependencia concreta del servicio. */
export type EstadoDependencia = "up" | "down";

/** Resultado agregado del chequeo de salud de un microservicio. */
export interface ResultadoSalud {
  status: "healthy" | "unhealthy";
  checks: Record<string, EstadoDependencia>;
  timestamp: string;
}

/** Comprueba las dependencias que el servicio tenga inyectadas. */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Optional() @Inject(DataSource) private readonly dataSource?: DataSource,
    @Optional()
    @Inject(RedisCacheService)
    private readonly redis?: RedisCacheService,
    @Optional()
    @Inject(EventBusService)
    private readonly eventBus?: EventBusService
  ) {}

  /** Estado de cada dependencia presente; el global cae a "unhealthy" si alguna falla. */
  async check(): Promise<ResultadoSalud> {
    const checks: Record<string, EstadoDependencia> = {};

    if (this.dataSource) {
      checks.database = await this.comprobar("database", async () => {
        await this.dataSource!.query("SELECT 1");
      });
    }

    if (this.redis) {
      checks.redis = await this.comprobar("redis", async () => {
        if (!(await this.redis!.ping())) {
          throw new Error("Redis no respondió PONG");
        }
      });
    }

    if (this.eventBus) {
      checks.rabbitmq = await this.comprobar("rabbitmq", async () => {
        if (!this.eventBus!.isConnected()) {
          throw new Error("Sin canal abierto contra RabbitMQ");
        }
      });
    }

    const todoBien = Object.values(checks).every((estado) => estado === "up");

    return {
      status: todoBien ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /** Ejecuta una sonda y traduce cualquier fallo a "down". */
  private async comprobar(
    nombre: string,
    sonda: () => Promise<void>
  ): Promise<EstadoDependencia> {
    try {
      await sonda();
      return "up";
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Health check de ${nombre} falló: ${mensaje}`);
      return "down";
    }
  }
}
