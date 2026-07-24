import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
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
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { ProfessionalsModule } from "./modules/professionals/professionals.module";
import { ServicesModule } from "./modules/services/services.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { PublicModule } from "./modules/public/public.module";
import { InternalClientsModule } from "./modules/internal-clients/internal-clients.module";
import { InternalProfilesModule } from "./modules/internal-profiles/internal-profiles.module";
import { BusinessHoursModule } from "./modules/business-hours/business-hours.module";
import { ImagesModule } from "./modules/images/images.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ServiceCategoriesModule } from "./modules/service-categories/service-categories.module";
import { CoreEventListenersModule } from "./modules/event-listeners/core-event-listeners.module";

const entities = [
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
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    BusinessesModule,
    BranchesModule,
    ProfessionalsModule,
    ServicesModule,
    ClientsModule,
    PublicModule,
    InternalClientsModule,
    InternalProfilesModule,
    BusinessHoursModule,
    ImagesModule,
    CategoriesModule,
    ServiceCategoriesModule,
    CoreEventListenersModule,
  ],
})
/** Módulo raíz del core-service: agrupa negocios, sedes, servicios, profesionales, clientes e imágenes. */
export class AppModule {}
