import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ServiceUrlsConfig } from "../../config/service-urls";

/**
 * Registra el health check agregado del gateway.
 *
 * El controlador existía desde hacía tiempo pero no estaba declarado en ningún
 * módulo, así que `GET /health` respondía 404 pese a que la documentación de
 * despliegue lo daba por funcionando. Declara su propio `ServiceUrlsConfig`
 * porque el de ProxyModule no se exporta.
 */
@Module({
  controllers: [HealthController],
  providers: [ServiceUrlsConfig],
})
export class HealthModule {}
