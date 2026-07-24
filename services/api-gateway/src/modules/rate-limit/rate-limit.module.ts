import { Module } from "@nestjs/common";
import { RateLimitGuard } from "./rate-limit.guard";

@Module({
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
/** Expone el guard de rate limiting basado en Redis. */
export class RateLimitModule {}
