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
/** Cablea el controlador y servicio que reenvían las peticiones a los microservicios. */
export class ProxyModule {}
