import { MigrationInterface, QueryRunner } from "typeorm";

/** Una caja abierta por sede, y la sede en la que se cobró cada pago. */
export class CajaPorSede1700000000010 implements MigrationInterface {
  name = "CajaPorSede1700000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "branch_id" uuid
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_cash_sessions_open_per_business"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_sessions_open_per_business"
      ON "cash_sessions" ("business_id")
      WHERE "closed_at" IS NULL AND "branch_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_sessions_open_per_branch"
      ON "cash_sessions" ("business_id", "branch_id")
      WHERE "closed_at" IS NULL AND "branch_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_cash_sessions_open_per_branch"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_cash_sessions_open_per_business"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_cash_sessions_open_per_business"
      ON "cash_sessions" ("business_id")
      WHERE "closed_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "branch_id"
    `);
  }
}
