import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ServiceUrlsConfig } from "../../config/service-urls";

/** Registra el health check agregado del gateway. */
@Module({
  controllers: [HealthController],
  providers: [ServiceUrlsConfig],
})
export class HealthModule {}
