import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "@beautyspot/nest-common";
import { BusinessesService } from "./businesses.service";
import {
  BusinessesController,
  InternalBusinessesController,
} from "./businesses.controller";
import { Business } from "../../entities/business.entity";
import { Branch } from "../../entities/branch.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { ServiceCategoryEntity } from "../../entities/service-category.entity";
import { ProfessionalCategoryEntity } from "../../entities/category.entity";
import { BusinessHours } from "../../entities/business-hours.entity";

@Module({
  imports: [
    // El catálogo y el horario con los que nace un negocio se escriben en la
    // misma transacción que él.
    TypeOrmModule.forFeature([
      Business,
      Branch,
      Service,
      Professional,
      ServiceCategoryEntity,
      ProfessionalCategoryEntity,
      BusinessHours,
    ]),
    OutboxModule,
  ],
  controllers: [BusinessesController, InternalBusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
/** Cablea el CRUD de negocios (público e interno). */
export class BusinessesModule {}
