import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";
import { ZonaDelNegocioModule } from "@beautyspot/nest-common";

/** Módulo del dashboard: expone los KPIs agregados para la vista de analítica. */
@Module({
  imports: [
    TypeOrmModule.forFeature([DailyMetricEntity, ProfessionalMetricEntity]),
    ZonaDelNegocioModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
