import { DataSource } from "typeorm";
import { join } from "path";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "../orm-entities";

/**
 * Comprueba contra Postgres real que las migraciones reproducen el esquema que
 * TypeORM deduce de las entidades: `createSchemaBuilder().log()` no devuelve
 * ninguna sentencia pendiente.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: las migraciones reproducen el esquema de las entidades", () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...createMigrationDataSourceOptions(
        entities,
        join(__dirname, "..", "migrations")
      ),
      // El log de queries de TypeORM ahogaría la salida del test.
      logging: false,
    });
    await dataSource.initialize();

    // Base en blanco: las migraciones tienen que ser capaces de levantar el
    // esquema entero por sí solas, no de completar lo que dejó otro fichero de
    // test (todos comparten la misma base).
    await dataSource.query("DROP SCHEMA public CASCADE");
    await dataSource.query("CREATE SCHEMA public");

    await dataSource.runMigrations();
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it("no deja ningún cambio pendiente frente a las entidades", async () => {
    const pendiente = await dataSource.driver.createSchemaBuilder().log();

    expect(pendiente.upQueries.map((q) => q.query)).toEqual([]);
  });
});
