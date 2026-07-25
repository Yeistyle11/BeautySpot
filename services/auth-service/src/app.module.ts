import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import {
  OutboxModule,
  SecurityModule,
  TOKEN_VERSION_RESOLVER,
} from "@beautyspot/nest-common";
import { DbTokenVersionResolver } from "./security/db-token-version.resolver";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { entities } from "./orm-entities";
import { User } from "./entities/user.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    SecurityModule.withResolver({
      imports: [TypeOrmModule.forFeature([User])],
      resolver: {
        provide: TOKEN_VERSION_RESOLVER,
        useClass: DbTokenVersionResolver,
      },
    }),
    OutboxModule,
    AuthModule,
    UsersModule,
    MembershipsModule,
  ],
})
/** Módulo raíz del auth-service: configura BD, eventos y los módulos de auth, usuarios y membresías. */
export class AppModule {}
