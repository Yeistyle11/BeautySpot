import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { AnalyticsEventListeners } from "./analytics-event-listeners.service";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [
    MetricsModule,
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: "beautyspot.events",
          type: "topic",
        },
      ],
      uri: process.env.RABBITMQ_URL || "amqp://localhost:5672",
      connectionInitOptions: { wait: false },
    }),
  ],
  providers: [AnalyticsEventListeners],
  exports: [AnalyticsEventListeners],
})
export class AnalyticsEventListenersModule {}
