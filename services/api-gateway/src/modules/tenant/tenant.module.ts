import { Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { ServiceUrlsConfig } from "../../config/service-urls";

@Module({
  providers: [TenantService, ServiceUrlsConfig],
  exports: [TenantService],
})
/** Expone el TenantService que resuelve el negocio a partir del subdominio. */
export class TenantModule {}
