import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MembershipsService } from "./memberships.service";
import { MembershipsController, InternalMembershipsController } from "./memberships.controller";
import { Membership } from "../../entities/membership.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Membership])],
  controllers: [MembershipsController, InternalMembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
