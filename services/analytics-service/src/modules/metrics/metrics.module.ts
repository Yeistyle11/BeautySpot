import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";

/** Módulo de métricas: acumulación y consulta de contadores diarios y por profesional. */
@Module({
  imports: [
    TypeOrmModule.forFeature([DailyMetricEntity, ProfessionalMetricEntity]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
