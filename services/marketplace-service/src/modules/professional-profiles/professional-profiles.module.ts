import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import { ProfessionalProfilesService } from "./professional-profiles.service";
import {
  ProfessionalProfilesController,
  InternalProfessionalProfilesController,
} from "./professional-profiles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([ProfessionalProfileEntity])],
  controllers: [
    ProfessionalProfilesController,
    InternalProfessionalProfilesController,
  ],
  providers: [ProfessionalProfilesService],
  exports: [ProfessionalProfilesService],
})
export class ProfessionalProfilesModule {}
