import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BlockedSlotsService } from "./blocked-slots.service";
import { BlockedSlotsController } from "./blocked-slots.controller";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { Appointment } from "../../entities/appointment.entity";
import { ZonaDelNegocioModule } from "@beautyspot/nest-common";

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockedSlot, Appointment]),
    ZonaDelNegocioModule,
  ],
  controllers: [BlockedSlotsController],
  providers: [BlockedSlotsService],
  exports: [BlockedSlotsService],
})
/** Cablea la gestión de bloqueos de agenda de los profesionales. */
export class BlockedSlotsModule {}
