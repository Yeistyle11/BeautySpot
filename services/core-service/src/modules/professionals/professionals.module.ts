import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfessionalsService } from "./professionals.service";
import { ProfessionalsController } from "./professionals.controller";
import { Professional } from "../../entities/professional.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Professional, ProfessionalService])],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
/** Cablea el CRUD de profesionales y su relación con servicios. */
export class ProfessionalsModule {}
