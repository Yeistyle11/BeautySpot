import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessProfileEntity,
      ProfessionalProfileEntity,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
/** Cablea la búsqueda de negocios y profesionales. */
export class SearchModule {}
