import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ServiceUrlsConfig } from "../../config/service-urls";

/**
 * Registra el health check agregado del gateway, que consulta el `/health` de
 * los siete microservicios.
 *
 * Declara su propio `ServiceUrlsConfig` porque `ProxyModule` no lo exporta.
 */
@Module({
  controllers: [HealthController],
  providers: [ServiceUrlsConfig],
})
export class HealthModule {}
