import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ReviewEntity } from "../../entities/review.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import { MarketplaceEventListeners } from "./marketplace-event-listeners.service";
import { BusinessProfilesModule } from "../business-profiles/business-profiles.module";

@Module({
  imports: [
    // Las reseñas de la ficha absorbida se reasignan al fusionar dos clientes, y
    // el perfil de un profesional copia su nombre y su foto de core.
    TypeOrmModule.forFeature([
      BusinessProfileEntity,
      ReviewEntity,
      ProfessionalProfileEntity,
    ]),
    BusinessProfilesModule,
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
  providers: [MarketplaceEventListeners],
  exports: [MarketplaceEventListeners],
})
/** Registra los listeners de eventos de RabbitMQ del marketplace. */
export class MarketplaceEventListenersModule {}
