import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { CapacidadWorker } from "./capacidad.worker";
import { NegocioMetricsService } from "./negocio-metrics.service";

describe("CapacidadWorker", () => {
  let worker: CapacidadWorker;
  let mockHttp: { pedirONulo: jest.Mock };
  let mockMetrics: { fijarCapacidadDelDia: jest.Mock };
  let mockDataSource: { query: jest.Mock };
  let config: Record<string, string>;

  /** `n` negocios con actividad, todos el mismo día. */
  const negocios = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      business_id: `negocio-${i}`,
      date: "2026-08-12",
    }));

  const EQUIPO = [
    { professionalId: "prof-1", minutosDisponibles: 480 },
    { professionalId: "prof-2", minutosDisponibles: 240 },
  ];

  beforeEach(async () => {
    config = {};
    mockHttp = { pedirONulo: jest.fn().mockResolvedValue(EQUIPO) };
    mockMetrics = {
      fijarCapacidadDelDia: jest.fn().mockResolvedValue(undefined),
    };
    mockDataSource = { query: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapacidadWorker,
        { provide: DataSource, useValue: mockDataSource },
        { provide: InternalHttpClient, useValue: mockHttp },
        { provide: NegocioMetricsService, useValue: mockMetrics },
        {
          provide: ConfigService,
          useValue: { get: (clave: string) => config[clave] },
        },
      ],
    }).compile();

    worker = module.get<CapacidadWorker>(CapacidadWorker);
  });

  afterEach(async () => {
    await worker.onModuleDestroy();
  });

  it("guarda el equipo de cada negocio en una sola escritura", async () => {
    mockDataSource.query.mockResolvedValue(negocios(1));

    await worker.materializar();

    expect(mockMetrics.fijarCapacidadDelDia).toHaveBeenCalledTimes(1);
    expect(mockMetrics.fijarCapacidadDelDia).toHaveBeenCalledWith(
      "negocio-0",
      "2026-08-12",
      EQUIPO
    );
  });

  // En serie, cien negocios activos son cien viajes encadenados a booking.
  it("resuelve los negocios en tandas y no de uno en uno", async () => {
    mockDataSource.query.mockResolvedValue(negocios(5));
    let simultaneas = 0;
    let maximo = 0;
    mockHttp.pedirONulo.mockImplementation(async () => {
      simultaneas++;
      maximo = Math.max(maximo, simultaneas);
      await Promise.resolve();
      simultaneas--;
      return EQUIPO;
    });

    await worker.materializar();

    expect(maximo).toBeGreaterThan(1);
    expect(mockHttp.pedirONulo).toHaveBeenCalledTimes(5);
  });

  it("un negocio que falla no se lleva por delante a los demas", async () => {
    mockDataSource.query.mockResolvedValue(negocios(3));
    mockHttp.pedirONulo.mockImplementation(async (_s: string, ruta: string) => {
      if (ruta.includes("negocio-1")) throw new Error("booking no responde");
      return EQUIPO;
    });

    await expect(worker.materializar()).resolves.toBeUndefined();
    expect(mockMetrics.fijarCapacidadDelDia).toHaveBeenCalledTimes(2);
  });

  it("no escribe si booking no devuelve capacidad", async () => {
    mockDataSource.query.mockResolvedValue(negocios(1));
    mockHttp.pedirONulo.mockResolvedValue(null);

    await worker.materializar();

    expect(mockMetrics.fijarCapacidadDelDia).not.toHaveBeenCalled();
  });

  it("un ciclo no arranca mientras el anterior sigue en curso", async () => {
    let resolver: (filas: unknown[]) => void = () => {};
    mockDataSource.query.mockReturnValue(
      new Promise((res) => {
        resolver = res;
      })
    );

    const primero = worker.materializar();
    await worker.materializar();

    expect(mockDataSource.query).toHaveBeenCalledTimes(1);

    resolver([]);
    await primero;
  });

  it("no arranca el sondeo si esta desactivado", () => {
    config.CAPACIDAD_ENABLED = "false";

    const apagado = new CapacidadWorker(
      mockDataSource as unknown as DataSource,
      mockHttp as unknown as InternalHttpClient,
      mockMetrics as unknown as NegocioMetricsService,
      { get: (clave: string) => config[clave] } as unknown as ConfigService
    );
    apagado.onModuleInit();

    expect(apagado.onModuleDestroy()).resolves.toBeUndefined();
  });
});
