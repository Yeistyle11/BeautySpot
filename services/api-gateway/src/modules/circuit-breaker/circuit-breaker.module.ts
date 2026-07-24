import { Module } from "@nestjs/common";
import { CircuitBreakerService } from "./circuit-breaker.service";

@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
/** Expone el CircuitBreakerService para envolver las llamadas del proxy a los backends. */
export class CircuitBreakerModule {}
