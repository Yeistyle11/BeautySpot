import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

/** Módulo de reportes: genera informes de métricas por rango de fechas. */
@Module({
  imports: [
    TypeOrmModule.forFeature([DailyMetricEntity, ProfessionalMetricEntity]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
