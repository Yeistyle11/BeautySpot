import Redis from "ioredis";

/**
 * Smoke test de integración: el api-gateway no tiene base propia, así que su
 * dependencia de infraestructura es Redis (rate limiting, caché de tenants y
 * sesiones revocadas). Comprueba que conecta con el de test (`test:int`).
 */
describe("Integración: conexión a Redis de test", () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      // Por defecto ioredis reintenta la conexión indefinidamente y encola las
      // órdenes, así que sin infraestructura el proceso de jest no termina
      // nunca. Aquí interesa fallar rápido y con un error claro.
      lazyConnect: true,
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    await redis.connect();
  });

  afterAll(async () => {
    if (!redis) return;
    try {
      await redis.quit();
    } catch {
      // Si la conexión ya está caída, quit() rechaza; basta con soltar el socket.
      redis.disconnect();
    }
  });

  it("responde al PING", async () => {
    await expect(redis.ping()).resolves.toBe("PONG");
  });

  it("escribe y lee una clave", async () => {
    await redis.set("integracion:smoke", "ok", "EX", 10);
    await expect(redis.get("integracion:smoke")).resolves.toBe("ok");
  });
});
