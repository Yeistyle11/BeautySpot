import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MembershipsService } from "./memberships.service";
import {
  MembershipsController,
  InternalMembershipsController,
} from "./memberships.controller";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Membership, AuditLog])],
  controllers: [MembershipsController, InternalMembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
/** Cablea los controladores (público e interno) y el servicio de membresías. */
export class MembershipsModule {}
