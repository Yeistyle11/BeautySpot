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
      increment: jest.fn().mockResolvedValue({ affected: 0 }),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
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

      // Un solo UPDATE para toda la tanda: guardar fila a fila alargaba la
      // transacción que mantiene el bloqueo del lote.
      expect(mockRepo.increment).toHaveBeenCalledTimes(1);
      expect(mockRepo.increment).toHaveBeenCalledWith(
        expect.anything(),
        "attempts",
        1
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(msg.attempts).toBe(1);
    });

    it("publica la tanda con varias emisiones en vuelo", async () => {
      const mensajes = Array.from({ length: 8 }, (_, i) =>
        makeMessage({ id: `msg-${i}`, attempts: 0 })
      );
      mockQb.getMany.mockResolvedValueOnce(mensajes).mockResolvedValue([]);

      let enCurso = 0;
      let maximoSimultaneo = 0;
      mockEventBus.emit.mockImplementation(async () => {
        maximoSimultaneo = Math.max(maximoSimultaneo, ++enCurso);
        await Promise.resolve();
        enCurso--;
      });

      await worker.poll();

      expect(mockEventBus.emit).toHaveBeenCalledTimes(8);
      expect(maximoSimultaneo).toBeGreaterThan(1);
    });

    it("vuelve a reclamar enseguida si la tanda salió llena", async () => {
      const llena = Array.from({ length: 50 }, (_, i) =>
        makeMessage({ id: `msg-${i}`, attempts: 0 })
      );
      mockQb.getMany.mockResolvedValueOnce(llena).mockResolvedValue([]);

      await worker.poll();

      // Tras un lote lleno vuelve a reclamar sin esperar al siguiente sondeo.
      expect(mockQb.getMany).toHaveBeenCalledTimes(2);
    });

    it("publica y marca PROCESSED cuando emit tiene éxito", async () => {
      const msg = makeMessage({ id: "msg-1", attempts: 0 });
      mockQb.getMany.mockResolvedValue([msg]);

      await worker.poll();

      // El eventId tiene que ser el id de la fila del outbox, no el del
      // agregado: es lo único estable entre reintentos de publicación, y es lo
      // que permite al consumidor descartar la reentrega.
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "payment.registered",
        { amount: 100 },
        { eventId: "msg-1", correlationId: "agg-1" }
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

    it("purga los mensajes ya publicados pasada la retención", async () => {
      mockQb.getMany.mockResolvedValue([]);
      mockRepo.delete.mockResolvedValue({ affected: 12 });

      // La purga es mantenimiento y no corre en cada sondeo.
      for (let i = 0; i <= 300; i++) await worker.poll();

      expect(mockRepo.delete).toHaveBeenCalledTimes(1);
      const [criterio] = mockRepo.delete.mock.calls[0];
      expect(criterio.status).toBe(OutboxStatus.PROCESSED);
      expect(criterio.processedAt).toBeDefined();
    });

    it("sigue publicando aunque la purga falle", async () => {
      mockQb.getMany.mockResolvedValue([makeMessage({ id: "m", attempts: 0 })]);
      mockRepo.delete.mockRejectedValue(new Error("sin permisos"));

      for (let i = 0; i <= 300; i++) await worker.poll();

      expect(mockEventBus.emit).toHaveBeenCalled();
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
