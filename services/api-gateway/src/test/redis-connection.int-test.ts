import Redis from "ioredis";

/**
 * Smoke test de integración: el api-gateway no tiene base de datos propia, así
 * que su dependencia de infraestructura es Redis (rate limiting, caché de
 * tenants y lista de sesiones revocadas). Verifica que puede conectarse al
 * Redis de test de docker-compose.test.yml, vía las REDIS_* de .env.test.
 *
 * Requiere la infraestructura de test levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: conexión a Redis de test", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    });
  });

  afterAll(async () => {
    await redis?.quit();
  });

  it("responde al PING", async () => {
    await expect(redis.ping()).resolves.toBe("PONG");
  });

  it("escribe y lee una clave", async () => {
    await redis.set("integracion:smoke", "ok", "EX", 10);
    await expect(redis.get("integracion:smoke")).resolves.toBe("ok");
  });
});
