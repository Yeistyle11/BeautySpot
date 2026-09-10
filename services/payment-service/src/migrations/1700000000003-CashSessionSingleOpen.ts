import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Garantiza en la base que un negocio no pueda tener dos sesiones de caja
 * abiertas a la vez: un índice único parcial sobre las sesiones sin cerrar,
 * que no admite la carrera del comprobar-antes-de-insertar.
 */
export class CashSessionSingleOpen1700000000003 implements MigrationInterface {
  name = "CashSessionSingleOpen1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_sessions_open_per_business"
      ON "cash_sessions" ("business_id")
      WHERE "closed_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_cash_sessions_open_per_business"
    `);
  }
}
