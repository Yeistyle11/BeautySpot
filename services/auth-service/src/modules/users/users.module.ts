import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { User } from "../../entities/user.entity";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, Membership, AuditLog])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
/** Cablea el controlador y servicio de usuarios y gestión de staff. */
export class UsersModule {}
