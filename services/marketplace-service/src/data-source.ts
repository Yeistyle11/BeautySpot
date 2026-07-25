import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
import { DataSource } from "typeorm";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "./orm-entities";

// El CLI de TypeORM no arranca Nest, así que ConfigModule nunca llega a cargar
// el .env: hay que leerlo aquí antes de construir las opciones, o DATABASE_URL
// llega vacío y el comando falla sin haber tocado la base.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

/**
 * DataSource que usa el CLI de TypeORM para `migration:run`, `migration:revert`
 * y `migration:generate`. La aplicación NO lo usa: ella construye el suyo en
 * app.module.ts a través de TypeOrmModule.
 */
export default new DataSource(
  createMigrationDataSourceOptions(entities, path.join(__dirname, "migrations"))
);
