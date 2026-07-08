import { Global, Module } from "@nestjs/common";
import { EventBusModule } from "../event-bus/event-bus.module";
import { OutboxService } from "./outbox.service";
import { OutboxRelayWorker } from "./outbox-relay.worker";

@Global()
@Module({
  imports: [EventBusModule],
  providers: [OutboxService, OutboxRelayWorker],
  exports: [OutboxService],
})
export class OutboxModule {}
