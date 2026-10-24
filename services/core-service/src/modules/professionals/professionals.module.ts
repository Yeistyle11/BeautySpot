import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "@beautyspot/nest-common";
import { ImagesModule } from "../images/images.module";
import { ProfessionalsService } from "./professionals.service";
import { CategoriesModule } from "../categories/categories.module";
import { ProfessionalsController } from "./professionals.controller";
import { Professional } from "../../entities/professional.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";
import { Service } from "../../entities/service.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Professional, ProfessionalService, Service]),
    CategoriesModule,
    OutboxModule,
    ImagesModule,
  ],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
/** Cablea el CRUD de profesionales y su relación con servicios. */
export class ProfessionalsModule {}
