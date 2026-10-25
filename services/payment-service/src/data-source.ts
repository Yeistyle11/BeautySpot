import "reflect-metadata";
import { existsSync } from "fs";
import * as path from "path";
import { DataSource } from "typeorm";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "./orm-entities";

// El CLI de TypeORM no arranca Nest: hay que cargar el .env aquí. En
// producción no hay archivo: las variables ya llegan del entorno.
const env = path.join(__dirname, "..", ".env");
if (existsSync(env)) process.loadEnvFile(env);

/** DataSource que usa el CLI de TypeORM para los comandos `migration:*`. */
export default new DataSource(
  createMigrationDataSourceOptions(entities, path.join(__dirname, "migrations"))
);
