import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_INTERCEPTOR } from "@nestjs/core";
import * as path from "path";
import { DailyMetricEntity } from "./entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "./entities/professional-metric.entity";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { AnalyticsEventListenersModule } from "./modules/event-listeners/analytics-event-listeners.module";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { TenantQueryInterceptor } from "@beautyspot/nest-common"; 
const entities = [DailyMetricEntity, ProfessionalMetricEntity];
 
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, "..", ".env") }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    DashboardModule,
    ReportsModule,
    MetricsModule,
    AnalyticsEventListenersModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantQueryInterceptor,
    },
  ],
})
export class AppModule {}
