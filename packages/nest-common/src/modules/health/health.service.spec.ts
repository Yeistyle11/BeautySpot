import { HealthService } from "./health.service";
import { RedisCacheService } from "../../cache/redis-cache.service";
import { EventBusService } from "../event-bus/event-bus.service";
import { DataSource } from "typeorm";

/** DataSource mínimo: al health check solo le interesa que el SELECT 1 responda. */
const dataSourceQueSirve = () =>
  ({
    query: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
  }) as unknown as DataSource;

const dataSourceCaido = () =>
  ({
    query: jest.fn().mockRejectedValue(new Error("connection refused")),
  }) as unknown as DataSource;

const redis = (responde: boolean) =>
  ({
    ping: jest.fn().mockResolvedValue(responde),
  }) as unknown as RedisCacheService;

const eventBus = (conectado: boolean) =>
  ({
    isConnected: jest.fn().mockReturnValue(conectado),
  }) as unknown as EventBusService;

describe("HealthService", () => {
  // El logger avisa de cada dependencia caída; en los tests solo ensucia.
  beforeAll(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("reporta healthy cuando todas las dependencias responden", async () => {
    const service = new HealthService(
      dataSourceQueSirve(),
      redis(true),
      eventBus(true)
    );

    const resultado = await service.check();

    expect(resultado.status).toBe("healthy");
    expect(resultado.checks).toEqual({
      database: "up",
      redis: "up",
      rabbitmq: "up",
    });
  });

  it("incluye una marca de tiempo ISO", async () => {
    const service = new HealthService(dataSourceQueSirve());

    const resultado = await service.check();

    expect(new Date(resultado.timestamp).toISOString()).toBe(
      resultado.timestamp
    );
  });

  // Cada servicio tiene dependencias distintas: el gateway no usa base de datos
  // y analytics no publica eventos.
  it("solo comprueba las dependencias que el servicio tiene inyectadas", async () => {
    const service = new HealthService(undefined, redis(true), undefined);

    const resultado = await service.check();

    expect(resultado.checks).toEqual({ redis: "up" });
    expect(resultado.status).toBe("healthy");
  });

  it("marca la base de datos como down si la consulta falla", async () => {
    const service = new HealthService(dataSourceCaido(), redis(true));

    const resultado = await service.check();

    expect(resultado.checks.database).toBe("down");
    expect(resultado.status).toBe("unhealthy");
  });

  it("marca Redis como down si no contesta PONG", async () => {
    const service = new HealthService(dataSourceQueSirve(), redis(false));

    const resultado = await service.check();

    expect(resultado.checks.redis).toBe("down");
    expect(resultado.status).toBe("unhealthy");
  });

  it("marca RabbitMQ como down si no hay canal abierto", async () => {
    const service = new HealthService(
      dataSourceQueSirve(),
      redis(true),
      eventBus(false)
    );

    const resultado = await service.check();

    expect(resultado.checks.rabbitmq).toBe("down");
    expect(resultado.status).toBe("unhealthy");
  });

  // Si la sonda propagara la excepción, el orquestador recibiría un 500 genérico
  // en lugar del detalle de qué dependencia está caída.
  it("no propaga el error de una dependencia caída", async () => {
    const redisQueExplota = {
      ping: jest.fn().mockRejectedValue(new Error("NOAUTH")),
    } as unknown as RedisCacheService;
    const service = new HealthService(dataSourceQueSirve(), redisQueExplota);

    await expect(service.check()).resolves.toMatchObject({
      status: "unhealthy",
      checks: { redis: "down" },
    });
  });

  it("tolera que una dependencia falle con algo que no es un Error", async () => {
    const redisRaro = {
      ping: jest.fn().mockRejectedValue("caída sin objeto Error"),
    } as unknown as RedisCacheService;
    const service = new HealthService(undefined, redisRaro);

    const resultado = await service.check();

    expect(resultado.checks.redis).toBe("down");
  });

  it("se reporta healthy si no tiene ninguna dependencia que comprobar", async () => {
    const service = new HealthService();

    const resultado = await service.check();

    expect(resultado).toMatchObject({ status: "healthy", checks: {} });
  });
});
