import { Module } from "@nestjs/common";
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { ServiceUrlsConfig } from "../../config/service-urls";
import { CircuitBreakerModule } from "../circuit-breaker/circuit-breaker.module";
 
@Module({
  imports: [CircuitBreakerModule],
  controllers: [ProxyController],
  providers: [ProxyService, ServiceUrlsConfig],
})
export class ProxyModule {}
