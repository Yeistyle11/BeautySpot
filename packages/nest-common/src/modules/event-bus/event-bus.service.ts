import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IBaseEvent } from "@beautyspot/event-types";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private connection: any = null;
  private channel: any = null;
  private connecting = false;
  private deadLetterChannel: any = null;
  private readonly DLX_EXCHANGE = "beautyspot.dlx";
  private readonly RETRY_EXCHANGE = "beautyspot.events";
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(private configService: ConfigService) {
    this.connect();
  }

  private async connect(): Promise<void> {
    const url = this.configService.get("RABBITMQ_URL");
    if (!url) {
      this.logger.warn("RABBITMQ_URL no configurado, EventBus no operacional");
      return;
    }

    try {
      this.connecting = true;
      const amqp = await import("amqplib");
      this.connection = await (amqp as any).default.connect(url);
      this.channel = await this.connection.createChannel();
      
      await this.setupExchangesAndQueues();
      
      this.connecting = false;
      this.logger.log("RabbitMQ conectado exitosamente");
    } catch (error: any) {
      this.connecting = false;
      this.logger.error(`Error conectando a RabbitMQ: ${error.message}`, error.stack);
    }
  }

  private async setupExchangesAndQueues(): Promise<void> {
    const { DLX_EXCHANGE, RETRY_EXCHANGE } = this;

    await this.channel.assertExchange(DLX_EXCHANGE, "topic", { durable: true });
    await this.channel.assertExchange(RETRY_EXCHANGE, "topic", { durable: true });

    await this.channel.assertQueue("beautyspot.dlx.retry", {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": RETRY_EXCHANGE,
      },
    });

    await this.channel.bindQueue("beautyspot.dlx.retry", RETRY_EXCHANGE, "#");

    this.deadLetterChannel = this.channel;
  }

  async emit<T>(eventType: string, payload: T, correlationId?: string, retryCount = 0): Promise<void> {
    if (!this.channel && !this.connecting) {
      await this.connect();
    }

    if (!this.channel) {
      this.logger.warn("Canal no disponible, evento no enviado");
      return;
    }

    const message: IBaseEvent<T> = {
      eventType,
      timestamp: new Date(),
      correlationId: correlationId || uuidv4(),
      payload,
    };

    try {
      await this.channel.publish(
        this.RETRY_EXCHANGE,
        eventType,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          deliveryMode: 2,
          expiration: "300000",
          timestamp: Date.now(),
          messageId: message.correlationId,
        },
      );
      
      if (retryCount > 0) {
        this.logger.log(`Evento ${eventType} reenviado exitosamente (intento ${retryCount + 1})`);
      }
    } catch (error: any) {
      if (retryCount < this.MAX_RETRIES) {
        this.logger.warn(`Error publicando evento ${eventType}, reintentando (${retryCount + 1}/${this.MAX_RETRIES})...`);
        
        await this.delay(this.RETRY_DELAY_MS * Math.pow(2, retryCount));
        return this.emit(eventType, payload, correlationId, retryCount + 1);
      }
      
      this.logger.error(`Evento ${eventType} falló después de ${this.MAX_RETRIES} intentos, enviando a DLQ`, error.stack);
      
      await this.publishToDLQ(message, error);
      
      this.channel = null;
      this.connection = null;
    }
  }

  private async publishToDLQ(message: IBaseEvent<any>, error: unknown): Promise<void> {
    if (!this.deadLetterChannel) {
      this.logger.error("Dead letter channel no disponible, evento perdido permanentemente");
      return;
    }

    const dlqMessage = {
      ...message,
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date(),
      stackTrace: error instanceof Error ? error.stack : undefined,
    };

    try {
      await this.deadLetterChannel.publish(
        this.DLX_EXCHANGE,
        message.eventType,
        Buffer.from(JSON.stringify(dlqMessage)),
        {
          persistent: true,
          deliveryMode: 2,
          timestamp: Date.now(),
        },
      );
      
      this.logger.log(`Evento ${message.eventType} enviado a Dead Letter Queue`);
    } catch (error: any) {
      this.logger.error(`Error publicando evento a Dead Letter Queue: ${error.message}`, error.stack);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.deadLetterChannel) await this.deadLetterChannel.close();
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.logger.log("RabbitMQ desconectado exitosamente");
    } catch (error: any) {
      this.logger.error(`Error cerrando conexión RabbitMQ: ${error.message}`);
    }
  }
}
