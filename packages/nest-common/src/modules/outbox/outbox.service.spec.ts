import { OutboxService } from "./outbox.service";
import { OutboxMessageEntity } from "./outbox-message.entity";

describe("OutboxService", () => {
  let service: OutboxService;
  let mockRepo: any;
  let mockManager: any;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn((entity: any) => ({ ...entity })),
      save: jest.fn((entity: any) =>
        Promise.resolve({ id: "uuid-generado", ...entity })
      ),
    };
    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
    };
    service = new OutboxService();
  });

  it("debería crear y guardar el mensaje con el repositorio del manager", async () => {
    const result = await service.enqueue(mockManager, {
      eventType: "payment.registered",
      aggregateType: "payment",
      aggregateId: "pay-123",
      payload: { amount: 100 },
    });

    expect(mockManager.getRepository).toHaveBeenCalledWith(OutboxMessageEntity);
    expect(mockRepo.create).toHaveBeenCalledWith({
      eventType: "payment.registered",
      aggregateType: "payment",
      aggregateId: "pay-123",
      payload: { amount: 100 },
    });
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result.id).toBe("uuid-generado");
  });

  it("debería usar exclusivamente el manager provisto (misma transacción que el caller)", async () => {
    await service.enqueue(mockManager, {
      eventType: "x",
      aggregateType: "y",
      aggregateId: "z",
      payload: {},
    });

    expect(mockManager.getRepository).toHaveBeenCalledTimes(1);
  });
});
