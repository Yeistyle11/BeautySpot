import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índice que el sondeo de cumpleaños puede usar de verdad. Busca por día y mes
 * de nacimiento, no por la fecha entera, y `EXTRACT(...)` sobre la columna deja
 * fuera cualquier índice declarado sobre `birth_date`: el que había no llegaba
 * a usarse nunca y el sondeo recorría la tabla cada hora.
 *
 * El predicado parcial es el del propio sondeo, que solo mira fichas vivas con
 * fecha puesta. Es un índice de expresión, que `@Index` no sabe declarar, así
 * que en desarrollo no existe: cambia el plan, no el resultado.
 */
export class CumpleanosIndexable1700000000019 implements MigrationInterface {
  name = "CumpleanosIndexable1700000000019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_dia_de_cumpleanos"
      ON "clients" (
        (EXTRACT(MONTH FROM "birth_date")),
        (EXTRACT(DAY FROM "birth_date"))
      )
      WHERE "birth_date" IS NOT NULL
        AND "active"
        AND "anonymized_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_clients_cumpleanos"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_cumpleanos"
      ON "clients" ("birth_date")
      WHERE "birth_date" IS NOT NULL
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_clients_dia_de_cumpleanos"`
    );
  }
}
