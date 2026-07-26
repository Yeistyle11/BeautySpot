import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
import { DataSource } from "typeorm";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "./orm-entities";

// El CLI de TypeORM no arranca Nest: hay que cargar el .env aquí.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

/** DataSource que usa el CLI de TypeORM para los comandos `migration:*`. */
export default new DataSource(
  createMigrationDataSourceOptions(entities, path.join(__dirname, "migrations"))
);
