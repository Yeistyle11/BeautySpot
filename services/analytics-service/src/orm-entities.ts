import { ProcessedEventEntity } from "@beautyspot/nest-common";
import { DailyMetricEntity } from "./entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "./entities/professional-metric.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  ProcessedEventEntity,
  DailyMetricEntity,
  ProfessionalMetricEntity,
];
