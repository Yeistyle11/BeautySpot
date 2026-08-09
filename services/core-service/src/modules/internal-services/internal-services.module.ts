import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Service } from "../../entities/service.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";
import { InternalServicesController } from "./internal-services.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Service, ProfessionalService])],
  controllers: [InternalServicesController],
})
/** Cablea el endpoint interno que resuelve precio y duración del catálogo. */
export class InternalServicesModule {}
