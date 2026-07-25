import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { BusinessProfileEntity } from "./entities/business-profile.entity";
import { ReviewEntity } from "./entities/review.entity";
import { ProfessionalProfileEntity } from "./entities/professional-profile.entity";
import { ReviewHelpfulEntity } from "./entities/review-helpful.entity";

/**
 * Entidades que gestiona este servicio, en un módulo aparte para que el
 * app.module y el data-source de migraciones compartan la misma lista.
 *
 * Si divergieran, `migration:generate` compararía el esquema contra una lista
 * incompleta y propondría borrar las tablas que le faltasen.
 */
export const entities = [
  BusinessProfileEntity,
  ReviewEntity,
  ProfessionalProfileEntity,
  ReviewHelpfulEntity,
  OutboxMessageEntity,
];
