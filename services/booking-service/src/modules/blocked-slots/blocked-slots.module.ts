import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BlockedSlotsService } from "./blocked-slots.service";
import { BlockedSlotsController } from "./blocked-slots.controller";
import { BlockedSlot } from "../../entities/blocked-slot.entity";

@Module({
  imports: [TypeOrmModule.forFeature([BlockedSlot])],
  controllers: [BlockedSlotsController],
  providers: [BlockedSlotsService],
  exports: [BlockedSlotsService],
})
export class BlockedSlotsModule {}
