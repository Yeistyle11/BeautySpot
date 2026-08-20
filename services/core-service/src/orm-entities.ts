import {
  OutboxMessageEntity,
  ProcessedEventEntity,
} from "@beautyspot/nest-common";
import { Business } from "./entities/business.entity";
import { Branch } from "./entities/branch.entity";
import { Professional } from "./entities/professional.entity";
import { ProfessionalService } from "./entities/professional-service.entity";
import { Service } from "./entities/service.entity";
import { Client } from "./entities/client.entity";
import { BusinessHours } from "./entities/business-hours.entity";
import { BusinessSpecialDay } from "./entities/business-special-day.entity";
import { BusinessConfig } from "./entities/business-config.entity";
import { ProfessionalCategoryEntity } from "./entities/category.entity";
import { ServiceCategoryEntity } from "./entities/service-category.entity";
import { CampoDeFicha } from "./entities/campo-de-ficha.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  ProcessedEventEntity,
  Business,
  Branch,
  Professional,
  ProfessionalService,
  Service,
  Client,
  BusinessHours,
  BusinessSpecialDay,
  BusinessConfig,
  ProfessionalCategoryEntity,
  ServiceCategoryEntity,
  CampoDeFicha,
  OutboxMessageEntity,
];
