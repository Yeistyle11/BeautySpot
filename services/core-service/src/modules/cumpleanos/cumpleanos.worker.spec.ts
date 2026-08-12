import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { CumpleanosWorker } from "./cumpleanos.worker";

describe("CumpleanosWorker", () => {
  let worker: CumpleanosWorker;
  let mockOutbox: { enqueue: jest.Mock };
  let mockDataSource: { query: jest.Mock; transaction: jest.Mock };
  let mockUpdate: { execute: jest.Mock };
  let config: Record<string, string>;

  const cumpleanero = {
    id: "client-123",
    businessId: "business-123",
    name: "Ana Gómez",
    email: "ana@example.com",
    anio: 2026,
  };

  /** Encadenado del query builder de la marca, que devuelve las filas afectadas. */
  const constructorDeUpdate = () => ({
    update: () => ({
      set: () => ({
        where: () => ({
          andWhere: () => mockUpdate,
        }),
      }),
    }),
  });

  beforeEach(async () => {
    config = {};
    mockOutbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    mockUpdate = { execute: jest.fn().mockResolvedValue({ affected: 1 }) };
    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest.fn((cb: (m: unknown) => unknown) =>
        cb({ createQueryBuilder: constructorDeUpdate })
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CumpleanosWorker,
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutbox },
        {
          provide: ConfigService,
          useValue: { get: (clave: string) => config[clave] },
        },
      ],
    }).compile();

    worker = module.get<CumpleanosWorker>(CumpleanosWorker);
  });

  afterEach(async () => {
    await worker.onModuleDestroy();
  });

  it("encola la felicitación de quien cumple años hoy", async () => {
    mockDataSource.query.mockResolvedValue([cumpleanero]);

    await worker.sondear();

    expect(mockOutbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: EventNames.CORE_CLIENT_BIRTHDAY,
        aggregateType: "client",
        aggregateId: "client-123",
        payload: expect.objectContaining({
          clientId: "client-123",
          businessId: "business-123",
          email: "ana@example.com",
          year: 2026,
        }),
      })
    );
  });

  it("no felicita si otra instancia se adelantó a marcar el año", async () => {
    mockDataSource.query.mockResolvedValue([cumpleanero]);
    mockUpdate.execute.mockResolvedValue({ affected: 0 });

    await worker.sondear();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("manda el evento sin correo cuando la ficha no lo tiene", async () => {
    mockDataSource.query.mockResolvedValue([{ ...cumpleanero, email: null }]);

    await worker.sondear();

    expect(mockOutbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ email: undefined }),
      })
    );
  });

  it("no hace nada si hoy no cumple años nadie", async () => {
    await worker.sondear();

    expect(mockDataSource.transaction).not.toHaveBeenCalled();
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no arranca el sondeo si está desactivado", () => {
    config.CUMPLEANOS_ENABLED = "false";

    const apagado = new CumpleanosWorker(
      mockDataSource as unknown as DataSource,
      mockOutbox as unknown as OutboxService,
      { get: (clave: string) => config[clave] } as unknown as ConfigService
    );
    apagado.onModuleInit();

    // Sin temporizador no hay nada que parar; destruirlo no debe fallar.
    expect(apagado.onModuleDestroy()).resolves.toBeUndefined();
  });

  it("un ciclo no arranca mientras el anterior sigue en curso", async () => {
    let resolverConsulta: (filas: unknown[]) => void = () => {};
    mockDataSource.query.mockReturnValue(
      new Promise((resolve) => {
        resolverConsulta = resolve;
      })
    );

    const primero = worker.sondear();
    await worker.sondear();

    expect(mockDataSource.query).toHaveBeenCalledTimes(1);

    resolverConsulta([]);
    await primero;
  });
});
