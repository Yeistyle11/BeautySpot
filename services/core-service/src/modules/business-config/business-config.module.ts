import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessConfig } from "../../entities/business-config.entity";
import { BusinessConfigService } from "./business-config.service";
import { BusinessConfigController } from "./business-config.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BusinessConfig])],
  controllers: [BusinessConfigController],
  providers: [BusinessConfigService],
  exports: [BusinessConfigService],
})
/** Cablea los ajustes por clave del negocio. */
export class BusinessConfigModule {}
