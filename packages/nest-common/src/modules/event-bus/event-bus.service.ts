import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IBaseEvent } from "@beautyspot/event-types";
import { v4 as uuidv4 } from "uuid";

/**
 * Publica eventos de dominio en RabbitMQ con entrega confiable.
 *
 * Los mensajes se emiten como persistentes sobre el exchange de eventos y se
 * reintentan con backoff exponencial; agotados los intentos, van a la Dead Letter
 * Queue (con un canal DLQ dedicado, e incluso una conexión de emergencia) para no
 * perderlos. Ante un fallo de canal, `emit` lanza en vez de descartar en silencio,
 * de modo que quien publica (p. ej. {@link OutboxRelayWorker}) pueda reintentar.
 */
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
      this.channel = null;
      this.deadLetterChannel = null;
      this.logger.error(
        `Error conectando a RabbitMQ: ${error.message}`,
        error.stack
      );
    }
  }

  private async setupExchangesAndQueues(): Promise<void> {
    const { DLX_EXCHANGE, RETRY_EXCHANGE } = this;

    await this.channel.assertExchange(DLX_EXCHANGE, "topic", { durable: true });
    await this.channel.assertExchange(RETRY_EXCHANGE, "topic", {
      durable: true,
    });

    // Cola terminal de Dead Letter: los mensajes aqui NO se reenvian al
    // exchange de retries (eso crearia un loop infinito). Se quedan para
    // inspeccion/reprocesamiento manual.
    await this.channel.assertQueue("beautyspot.dlx.dead", {
      durable: true,
    });
    await this.channel.bindQueue("beautyspot.dlx.dead", DLX_EXCHANGE, "#");

    // Canal dedicado para publicar a la DLQ, independiente del canal principal.
    // Si el canal principal muere, este canal sigue operativo para enrutar
    // el evento fallido a la DLQ.
    this.deadLetterChannel = await this.connection.createChannel();
  }

  async emit<T>(
    eventType: string,
    payload: T,
    correlationId?: string,
    retryCount = 0
  ): Promise<void> {
    if (!this.channel && !this.connecting) {
      await this.connect();
    }

    if (!this.channel) {
      // Fail-loud: lanza en vez de dropear silenciosamente. Asi los callers
      // (p.ej. OutboxRelayWorker) pueden atrapar el error y reintentar. Los
      // servicios que aun publican directamente veran el fallo explicito en
      // vez de perder el evento sin mas (fail-closed).
      throw new Error("Canal RabbitMQ no disponible, evento no publicado");
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
        }
      );

      if (retryCount > 0) {
        this.logger.log(
          `Evento ${eventType} reenviado exitosamente (intento ${retryCount + 1})`
        );
      }
    } catch (error: any) {
      // retryCount + 1 < MAX_RETRIES => reintenta (el intento inicial cuenta).
      // Total de intentos antes de DLQ = MAX_RETRIES.
      if (retryCount + 1 < this.MAX_RETRIES) {
        this.logger.warn(
          `Error publicando evento ${eventType}, reintentando (${retryCount + 1}/${this.MAX_RETRIES})...`
        );

        await this.delay(this.RETRY_DELAY_MS * Math.pow(2, retryCount));
        return this.emit(eventType, payload, correlationId, retryCount + 1);
      }

      this.logger.error(
        `Evento ${eventType} falló después de ${this.MAX_RETRIES} intentos, enviando a DLQ`,
        error.stack
      );

      await this.publishToDLQ(message, error);

      // Invalida solo el canal principal; el canal DLQ dedicado se mantiene.
      this.channel = null;
    }
  }

  private async publishToDLQ(
    message: IBaseEvent<any>,
    error: unknown
  ): Promise<void> {
    const dlqMessage = {
      ...message,
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date(),
      stackTrace: error instanceof Error ? error.stack : undefined,
    };

    const published = await this.tryPublishToDLQ(dlqMessage, message.eventType);

    if (!published) {
      // El canal DLQ dedicado fallo (p.ej. conexion muerta): abrir una
      // conexion y canal frescos SOLO para salvar este evento en la DLQ.
      this.logger.warn(
        "Canal DLQ no disponible, abriendo conexion de emergencia..."
      );
      await this.tryPublishToDLQWithFreshConnection(
        dlqMessage,
        message.eventType
      );
    }
  }

  private async tryPublishToDLQ(
    dlqMessage: any,
    eventType: string
  ): Promise<boolean> {
    if (!this.deadLetterChannel) {
      return false;
    }
    try {
      await this.deadLetterChannel.publish(
        this.DLX_EXCHANGE,
        eventType,
        Buffer.from(JSON.stringify(dlqMessage)),
        {
          persistent: true,
          deliveryMode: 2,
          timestamp: Date.now(),
        }
      );
      this.logger.log(`Evento ${eventType} enviado a Dead Letter Queue`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Error publicando evento a Dead Letter Queue: ${err.message}`,
        err.stack
      );
      return false;
    }
  }

  private async tryPublishToDLQWithFreshConnection(
    dlqMessage: any,
    eventType: string
  ): Promise<void> {
    const url = this.configService.get("RABBITMQ_URL");
    if (!url) {
      this.logger.error(
        "No se pudo salvar evento en DLQ: RABBITMQ_URL no configurado, evento perdido permanentemente"
      );
      return;
    }
    try {
      const amqp = await import("amqplib");
      const conn = await (amqp as any).default.connect(url);
      const ch = await conn.createChannel();
      await ch.assertExchange(this.DLX_EXCHANGE, "topic", { durable: true });
      await ch.publish(
        this.DLX_EXCHANGE,
        eventType,
        Buffer.from(JSON.stringify(dlqMessage)),
        { persistent: true, deliveryMode: 2, timestamp: Date.now() }
      );
      this.logger.log(
        `Evento ${eventType} salvado en DLQ via conexion de emergencia`
      );
      await ch.close();
      await conn.close();
    } catch (err: any) {
      this.logger.error(
        `No se pudo salvar evento en DLQ (conexion de emergencia fallo): ${err.message}. Evento perdido permanentemente`,
        err.stack
      );
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
