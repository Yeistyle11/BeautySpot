import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índice de expresión sobre el día y el mes de nacimiento, parcial sobre las
 * fichas vivas con fecha, que es lo que mira el sondeo. Solo en producción.
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
