import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MembershipsService } from "./memberships.service";
import {
  MembershipsController,
  InternalMembershipsController,
} from "./memberships.controller";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { OutboxModule } from "@beautyspot/nest-common";

@Module({
  imports: [TypeOrmModule.forFeature([Membership, AuditLog]), OutboxModule],
  controllers: [MembershipsController, InternalMembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
/** Cablea los controladores (público e interno) y el servicio de membresías. */
export class MembershipsModule {}
