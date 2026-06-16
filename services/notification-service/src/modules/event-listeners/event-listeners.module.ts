import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { NotificationEventListeners } from './event-listeners.service';
import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [
    EmailsModule,
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'beautyspot.events',
          type: 'topic',
        },
      ],
      uri: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      connectionInitOptions: { wait: false },
    }),
  ],
  providers: [NotificationEventListeners],
  exports: [NotificationEventListeners],
})
export class EventListenersModule {}
