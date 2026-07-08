import { ConfigService } from "@nestjs/config";
import { OutboxRelayWorker } from "./outbox-relay.worker";
import { OutboxStatus } from "./outbox-message.entity";

describe("OutboxRelayWorker", () => {
  let worker: OutboxRelayWorker;
  let mockDataSource: any;
  let mockManager: any;
  let mockRepo: any;
  let mockQb: any;
  let mockEventBus: any;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.useFakeTimers();

    mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockRepo = {
      createQueryBuilder: jest.fn(() => mockQb),
      save: jest.fn((rows: any[]) => Promise.resolve(rows)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
    };
    mockDataSource = {
      transaction: jest.fn(async (fn: (m: any) => Promise<any>) =>
        fn(mockManager)
      ),
      getRepository: jest.fn().mockReturnValue(mockRepo),
    };
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "OUTBOX_RELAY_ENABLED") return undefined; // default enabled
        return undefined; // defaults for numerics
      }),
    } as any;

    worker = new OutboxRelayWorker(
      mockDataSource,
      mockEventBus,
      mockConfigService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function makeMessage(overrides: Partial<any> = {}) {
    return {
      id: "msg-1",
      aggregateType: "payment",
      aggregateId: "agg-1",
      eventType: "payment.registered",
      payload: { amount: 100 },
      status: OutboxStatus.PENDING,
      attempts: 0,
      createdAt: new Date(),
      ...overrides,
    };
  }

  describe("poll", () => {
    it("no haría nada si no hay mensajes PENDING", async () => {
      await worker.poll();

      expect(mockEventBus.emit).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it("incrementa attempts al reclamar la tanda", async () => {
      const msg = makeMessage({ id: "msg-1", attempts: 0 });
      mockQb.getMany.mockResolvedValue([msg]);

      await worker.poll();

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: "msg-1", attempts: 1 }),
      ]);
    });

    it("publica y marca PROCESSED cuando emit tiene éxito", async () => {
      const msg = makeMessage({ id: "msg-1", attempts: 0 });
      mockQb.getMany.mockResolvedValue([msg]);

      await worker.poll();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "payment.registered",
        { amount: 100 },
        "agg-1"
      );
      expect(mockRepo.update).toHaveBeenCalledWith(
        "msg-1",
        expect.objectContaining({
          status: OutboxStatus.PROCESSED,
          lastError: null,
        })
      );
    });

    it("deja en PENDING y registra lastError cuando emit falla (intentos restantes)", async () => {
      const msg = makeMessage({ id: "msg-2", attempts: 1 });
      mockQb.getMany.mockResolvedValue([msg]);
      mockEventBus.emit.mockRejectedValue(new Error("canal caído"));

      await worker.poll();

      expect(mockRepo.update).toHaveBeenCalledWith(
        "msg-2",
        expect.objectContaining({
          status: OutboxStatus.PENDING,
          lastError: "canal caído",
        })
      );
    });

    it("marca DEAD cuando se agotan los intentos", async () => {
      // attempts parte en 4, el claim lo sube a 5 (== max por defecto)
      const msg = makeMessage({ id: "msg-3", attempts: 4 });
      mockQb.getMany.mockResolvedValue([msg]);
      mockEventBus.emit.mockRejectedValue(new Error("canal caído"));

      await worker.poll();

      expect(mockRepo.update).toHaveBeenCalledWith(
        "msg-3",
        expect.objectContaining({
          status: OutboxStatus.DEAD,
          lastError: "canal caído",
        })
      );
    });

    it("procesa toda la tanda reclamada", async () => {
      const msgs = [
        makeMessage({ id: "a", attempts: 0 }),
        makeMessage({ id: "b", attempts: 0 }),
      ];
      mockQb.getMany.mockResolvedValue(msgs);

      await worker.poll();

      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
      expect(mockRepo.update).toHaveBeenCalledTimes(2);
    });

    it("claim usa FOR UPDATE SKIP LOCKED vía setLock + setOnLocked", async () => {
      mockQb.getMany.mockResolvedValue([]);

      await worker.poll();

      expect(mockQb.setLock).toHaveBeenCalledWith("pessimistic_write");
      expect(mockQb.setOnLocked).toHaveBeenCalledWith("skip_locked");
      expect(mockQb.take).toHaveBeenCalled();
    });
  });

  describe("configuración y lifecycle", () => {
    it("no inicia el timer cuando OUTBOX_RELAY_ENABLED=false", () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === "OUTBOX_RELAY_ENABLED" ? "false" : undefined
      );
      const disabledWorker = new OutboxRelayWorker(
        mockDataSource,
        mockEventBus,
        mockConfigService
      );

      disabledWorker.onModuleInit();

      // sin timer activo: avanzar timers no dispara poll
      const emitSpy = mockEventBus.emit;
      jest.advanceTimersByTime(10000);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("onModuleDestroy limpia el timer sin lanzar", async () => {
      worker.onModuleInit();
      await expect(worker.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
