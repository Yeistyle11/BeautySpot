import { ProcessedEventEntity } from "@beautyspot/nest-common";
import { DailyMetricEntity } from "./entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "./entities/professional-metric.entity";
import { ClientMetricEntity } from "./entities/client-metric.entity";
import { ServiceMetricEntity } from "./entities/service-metric.entity";
import { CapacityDailyEntity } from "./entities/capacity-daily.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  ProcessedEventEntity,
  DailyMetricEntity,
  ProfessionalMetricEntity,
  ClientMetricEntity,
  ServiceMetricEntity,
  CapacityDailyEntity,
];
