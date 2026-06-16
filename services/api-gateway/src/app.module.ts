import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as path from "path";
import { ProxyModule } from "./modules/proxy/proxy.module";
import { AuthGatewayModule } from "./modules/auth-gateway/auth-gateway.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { RateLimitModule } from "./modules/rate-limit/rate-limit.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, "..", ".env") }),
    ProxyModule,
    AuthGatewayModule,
    TenantModule,
    RateLimitModule,
  ],
})
export class AppModule {}
