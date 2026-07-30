import { Global, Module } from "@nestjs/common";
import { ProcessedEventsStore } from "./processed-events.store";
import { ProcessedEventsPurgeWorker } from "./processed-events-purge.worker";

/**
 * Expone {@link ProcessedEventsStore} y programa la purga de las marcas
 * caducadas. El servicio que lo importe debe registrar `ProcessedEventEntity` y
 * crear su tabla con una migración.
 */
@Global()
@Module({
  providers: [ProcessedEventsStore, ProcessedEventsPurgeWorker],
  exports: [ProcessedEventsStore],
})
export class IdempotencyModule {}
