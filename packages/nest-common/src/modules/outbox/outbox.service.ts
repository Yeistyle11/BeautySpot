import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { OutboxMessageEntity } from "./outbox-message.entity";

/** Datos de un evento a encolar en el outbox: tipo, agregado de origen y payload. */
export interface OutboxMessageInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

/**
 * Persiste eventos en la tabla outbox dentro de la misma transacción que el
 * cambio de negocio, para que {@link OutboxRelayWorker} los publique después y
 * no se pierda ninguno si RabbitMQ está caído.
 */
@Injectable()
export class OutboxService {
  /** Inserta el mensaje en el outbox usando el EntityManager de la transacción en curso. */
  async enqueue(
    manager: EntityManager,
    message: OutboxMessageInput
  ): Promise<OutboxMessageEntity> {
    const repo = manager.getRepository(OutboxMessageEntity);
    return repo.save(
      repo.create({
        eventType: message.eventType,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        payload: message.payload,
      })
    );
  }
}
