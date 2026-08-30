import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfessionalService } from "../../entities/professional-service.entity";
import { PreciosService } from "./precios.service";

@Module({
  imports: [TypeOrmModule.forFeature([ProfessionalService])],
  providers: [PreciosService],
  exports: [PreciosService],
})
/**
 * Cablea la tarifa efectiva, que comparten el escaparate público y la ruta
 * interna con la que la agenda calcula el importe de una cita.
 */
export class PreciosModule {}
