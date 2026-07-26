import { Global, Module } from "@nestjs/common";
import { ProcessedEventsStore } from "./processed-events.store";

/**
 * Expone {@link ProcessedEventsStore}. El servicio que lo importe debe registrar
 * `ProcessedEventEntity` y crear su tabla con una migración.
 */
@Global()
@Module({
  providers: [ProcessedEventsStore],
  exports: [ProcessedEventsStore],
})
export class IdempotencyModule {}
