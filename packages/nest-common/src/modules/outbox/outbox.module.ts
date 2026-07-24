import { Global, Module } from "@nestjs/common";
import { EventBusModule } from "../event-bus/event-bus.module";
import { OutboxService } from "./outbox.service";
import { OutboxRelayWorker } from "./outbox-relay.worker";

/**
 * Módulo global del patrón Outbox: expone {@link OutboxService} para encolar eventos
 * y arranca {@link OutboxRelayWorker} que los publica en RabbitMQ.
 */
@Global()
@Module({
  imports: [EventBusModule],
  providers: [OutboxService, OutboxRelayWorker],
  exports: [OutboxService],
})
export class OutboxModule {}
