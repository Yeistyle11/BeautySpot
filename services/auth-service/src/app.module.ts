import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { User } from "./entities/user.entity";
import { Membership } from "./entities/membership.entity";
import { PasswordReset } from "./entities/password-reset.entity";
import { AuditLog } from "./entities/audit-log.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, "..", ".env") }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createTypeOrmModuleOptions([User, Membership, PasswordReset, AuditLog]),
      }),
    }),
    AuthModule,
    UsersModule,
    MembershipsModule,
  ],
})
export class AppModule {}
