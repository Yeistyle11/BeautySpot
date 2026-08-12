import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Client } from "../../entities/client.entity";
import { CumpleanosWorker } from "./cumpleanos.worker";

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  providers: [CumpleanosWorker],
})
/** Cablea el sondeo que publica las felicitaciones de cumpleaños. */
export class CumpleanosModule {}
