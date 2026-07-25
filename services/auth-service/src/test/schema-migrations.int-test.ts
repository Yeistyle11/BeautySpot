import { DataSource } from "typeorm";
import { join } from "path";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "../orm-entities";

/**
 * Verifica contra Postgres real que las migraciones reproducen EXACTAMENTE el
 * esquema que TypeORM deduce de las entidades.
 *
 * Es la única comprobación fiable de una migración escrita a mano: en
 * desarrollo y en los tests el esquema lo crea `synchronize`, así que un error
 * en el DDL no se nota hasta desplegar a producción, donde `synchronize` está
 * desactivado y la migración es la única fuente del esquema.
 *
 * `createSchemaBuilder().log()` devuelve las sentencias que `synchronize`
 * ejecutaría ahora mismo. Si la migración es fiel, esa lista está vacía; si
 * falta una columna, un índice o un default, aparece aquí el ALTER que lo
 * delata.
 *
 * Requiere la infraestructura de test levantada; se ejecuta con `npm run test:int`.
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
