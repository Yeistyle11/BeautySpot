import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";
import { ClientMetricEntity } from "../../entities/client-metric.entity";
import { ServiceMetricEntity } from "../../entities/service-metric.entity";
import { CapacityDailyEntity } from "../../entities/capacity-daily.entity";
import { MetricsService } from "./metrics.service";
import { NegocioMetricsService } from "./negocio-metrics.service";
import { CapacidadWorker } from "./capacidad.worker";
import { InternalHttpModule } from "@beautyspot/nest-common";
import { MetricsController } from "./metrics.controller";

/** Módulo de métricas: acumulación y consulta de contadores diarios y por profesional. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyMetricEntity,
      ProfessionalMetricEntity,
      ClientMetricEntity,
      ServiceMetricEntity,
      CapacityDailyEntity,
    ]),
    InternalHttpModule,
  ],
  controllers: [MetricsController],
  providers: [MetricsService, NegocioMetricsService, CapacidadWorker],
  exports: [MetricsService, NegocioMetricsService],
})
export class MetricsModule {}
