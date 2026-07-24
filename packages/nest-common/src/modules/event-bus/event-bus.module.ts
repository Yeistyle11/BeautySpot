import { Global, Module } from "@nestjs/common";
import { EventBusService } from "./event-bus.service";

/** Módulo global que expone {@link EventBusService} para publicar eventos en RabbitMQ. */
@Global()
@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
