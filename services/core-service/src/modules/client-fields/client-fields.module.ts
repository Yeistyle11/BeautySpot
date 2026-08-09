import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampoDeFicha } from "../../entities/campo-de-ficha.entity";
import { ClientFieldsService } from "./client-fields.service";
import { ClientFieldsController } from "./client-fields.controller";

@Module({
  imports: [TypeOrmModule.forFeature([CampoDeFicha])],
  controllers: [ClientFieldsController],
  providers: [ClientFieldsService],
  exports: [ClientFieldsService],
})
/** Cablea los campos configurables de la ficha del cliente. */
export class ClientFieldsModule {}
