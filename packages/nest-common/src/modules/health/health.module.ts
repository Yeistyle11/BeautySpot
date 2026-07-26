import { Module } from "@nestjs/common";
import { RedisCacheModule } from "../../cache/redis-cache.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

/** Expone GET /health en el servicio que lo importe. */
@Module({
  imports: [RedisCacheModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
