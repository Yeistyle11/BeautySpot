import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtGatewayStrategy } from "./jwt-gateway.strategy";
import { AuthGatewayGuard } from "./auth-gateway.guard";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtGatewayStrategy, AuthGatewayGuard],
  exports: [AuthGatewayGuard],
})
/** Cablea la estrategia y el guard JWT que protegen las rutas del gateway. */
export class AuthGatewayModule {}
