import { Global, Module } from "@nestjs/common";
import { ProcessedEventsStore } from "./processed-events.store";

/**
 * Expone {@link ProcessedEventsStore} a los consumidores de eventos del
 * servicio. Es global porque los listeners viven en módulos de dominio
 * dispersos y ninguno debería tener que importarlo por su cuenta.
 *
 * El servicio que lo importe tiene que registrar `ProcessedEventEntity` en su
 * lista de entidades y crear la tabla con una migración.
 */
@Global()
@Module({
  providers: [ProcessedEventsStore],
  exports: [ProcessedEventsStore],
})
export class IdempotencyModule {}
