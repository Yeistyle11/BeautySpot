import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { AnalyticsEventListeners } from "./analytics-event-listeners.service";
import { MetricsModule } from "../metrics/metrics.module";

/** Módulo que suscribe el analytics-service a los eventos de RabbitMQ para alimentar las métricas. */
@Module({
  imports: [
    MetricsModule,
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        exchanges: [
          { name: EVENTS_EXCHANGE, type: "topic" },
          { name: DEAD_LETTER_EXCHANGE, type: "topic" },
        ],
        uri: config.get<string>("RABBITMQ_URL") ?? "amqp://localhost:5672",
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  providers: [AnalyticsEventListeners],
  exports: [AnalyticsEventListeners],
})
export class AnalyticsEventListenersModule {}
