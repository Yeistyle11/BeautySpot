import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as path from "path";
import { ProxyModule } from "./modules/proxy/proxy.module";
import { AuthGatewayModule } from "./modules/auth-gateway/auth-gateway.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { RateLimitModule } from "./modules/rate-limit/rate-limit.module";
import { RedisModule } from "./modules/redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    RedisModule,
    ProxyModule,
    AuthGatewayModule,
    TenantModule,
    RateLimitModule,
  ],
})
/** Módulo raíz del gateway: reúne configuración, Redis y los módulos de enrutado y seguridad. */
export class AppModule {}
