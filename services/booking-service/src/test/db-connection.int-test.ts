import { DataSource } from "typeorm";

/**
 * Smoke test: comprueba que el servicio conecta con la base de datos de test.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
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
