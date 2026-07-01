import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { BusinessProfilesService } from "./business-profiles.service";
import {
  BusinessProfilesController,
  PublicProfilesController,
  InternalBusinessProfilesController,
} from "./business-profiles.controller";
import { ProfessionalProfilesModule } from "../professional-profiles/professional-profiles.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessProfileEntity]),
    ProfessionalProfilesModule,
  ],
  controllers: [
    BusinessProfilesController,
    PublicProfilesController,
    InternalBusinessProfilesController,
  ],
  providers: [BusinessProfilesService],
  exports: [BusinessProfilesService],
})
export class BusinessProfilesModule {}
