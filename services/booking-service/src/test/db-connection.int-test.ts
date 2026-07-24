import { DataSource } from "typeorm";

/**
 * Smoke test de integración: verifica que el servicio puede conectarse a la base
 * de datos de test real (la de docker-compose.test.yml, vía DATABASE_URL de
 * .env.test). Sirve de plantilla para escribir tests de integración de verdad
 * (repositorios, Outbox, disponibilidad) contra Postgres/Redis/RabbitMQ reales.
 *
 * Requiere la infraestructura de test levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: conexión a la base de datos de test", () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it("responde a un SELECT de prueba", async () => {
    const result = await dataSource.query("SELECT 1 AS ok");
    expect(Number(result[0].ok)).toBe(1);
  });
});
