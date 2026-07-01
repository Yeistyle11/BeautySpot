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
export class MembershipsModule {}
