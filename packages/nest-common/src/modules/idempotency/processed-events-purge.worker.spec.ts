import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { ProcessedEventsPurgeWorker } from "./processed-events-purge.worker";

describe("ProcessedEventsPurgeWorker", () => {
  let borrar: jest.Mock;
  let dataSource: DataSource;

  /** Worker con la configuración indicada y un repositorio simulado. */
  const build = (config: Record<string, string> = {}) => {
    const worker = new ProcessedEventsPurgeWorker(dataSource, {
      get: (clave: string) => config[clave],
    } as unknown as ConfigService);
    jest.spyOn(worker["logger"], "warn").mockImplementation(() => undefined);
    jest.spyOn(worker["logger"], "log").mockImplementation(() => undefined);
    return worker;
  };

  beforeEach(() => {
    borrar = jest.fn().mockResolvedValue({ affected: 0 });
    dataSource = {
      getRepository: jest.fn().mockReturnValue({ delete: borrar }),
    } as unknown as DataSource;
  });

  afterEach(() => jest.useRealTimers());

  it("borra las marcas anteriores al límite de retención", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-01T00:00:00Z"));
    borrar.mockResolvedValue({ affected: 12 });

    await expect(build().purgar()).resolves.toBe(12);

    const [criterio] = borrar.mock.calls[0];
    // Por defecto se conservan 30 días: el margen para que RabbitMQ reentregue
    // un mensaje que estuvo esperando a un consumidor caído.
    expect(criterio.processedAt.value).toEqual(
      new Date("2026-07-02T00:00:00Z")
    );
  });

  it("respeta la retención configurada", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-01T00:00:00Z"));

    await build({ PROCESSED_EVENTS_RETENTION_DAYS: "7" }).purgar();

    const [criterio] = borrar.mock.calls[0];
    expect(criterio.processedAt.value).toEqual(
      new Date("2026-07-25T00:00:00Z")
    );
  });

  it("no propaga el error si la purga falla", async () => {
    borrar.mockRejectedValue(new Error("sin permisos"));

    // Es mantenimiento: que falle no debe afectar al consumo de eventos.
    await expect(build().purgar()).resolves.toBe(0);
  });

  it("no programa nada si está desactivada", () => {
    const worker = build({ PROCESSED_EVENTS_PURGE_ENABLED: "false" });

    worker.onModuleInit();

    expect(worker["timer"]).toBeNull();
  });

  it("programa la purga y la detiene al parar el servicio", () => {
    jest.useFakeTimers();
    const worker = build();

    worker.onModuleInit();
    expect(worker["timer"]).not.toBeNull();

    worker.onModuleDestroy();
    expect(worker["timer"]).toBeNull();
  });
});
