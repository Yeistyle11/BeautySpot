import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { OutboxMessageEntity } from "./outbox-message.entity";

export interface OutboxMessageInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
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
