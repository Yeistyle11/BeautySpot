import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { User } from "../../entities/user.entity";
import { PasswordReset } from "../../entities/password-reset.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { EventBusModule } from "@beautyspot/nest-common";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordReset, AuditLog]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          // @nestjs/jwt v11 tipa expiresIn como number|StringValue; el valor de
          // configuración es una cadena válida ("15m") que jsonwebtoken acepta.
          expiresIn: configService.get<string>(
            "JWT_EXPIRES_IN",
            "15m"
          ) as JwtSignOptions["expiresIn"],
        },
      }),
      inject: [ConfigService],
    }),
    EventBusModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
/** Cablea el controlador, servicio y estrategia JWT de autenticación. */
export class AuthModule {}
