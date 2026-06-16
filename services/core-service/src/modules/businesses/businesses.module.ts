import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessesService } from "./businesses.service";
import { BusinessesController, InternalBusinessesController } from "./businesses.controller";
import { Business } from "../../entities/business.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Business])],
  controllers: [BusinessesController, InternalBusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
