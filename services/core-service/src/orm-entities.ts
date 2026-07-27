import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { Business } from "./entities/business.entity";
import { Branch } from "./entities/branch.entity";
import { Professional } from "./entities/professional.entity";
import { ProfessionalService } from "./entities/professional-service.entity";
import { Service } from "./entities/service.entity";
import { Client } from "./entities/client.entity";
import { BusinessHours } from "./entities/business-hours.entity";
import { BusinessConfig } from "./entities/business-config.entity";
import { ProfessionalCategoryEntity } from "./entities/category.entity";
import { ServiceCategoryEntity } from "./entities/service-category.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  Business,
  Branch,
  Professional,
  ProfessionalService,
  Service,
  Client,
  BusinessHours,
  BusinessConfig,
  ProfessionalCategoryEntity,
  ServiceCategoryEntity,
  OutboxMessageEntity,
];
