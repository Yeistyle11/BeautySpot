import { Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { ServiceUrlsConfig } from "../../config/service-urls";

@Module({
  providers: [TenantService, ServiceUrlsConfig],
  exports: [TenantService],
})
export class TenantModule {}
