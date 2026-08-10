import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Método y pago de origen de cada movimiento de caja, para desglosar el cierre.
 * Las filas existentes quedan marcadas como efectivo.
 */
export class MetodoEnLosMovimientos1700000000008 implements MigrationInterface {
  name = "MetodoEnLosMovimientos1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_movements"
        ADD COLUMN IF NOT EXISTS "method" character varying,
        ADD COLUMN IF NOT EXISTS "payment_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "cash_movements" SET "method" = 'CASH' WHERE "method" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_movements"
        DROP COLUMN IF EXISTS "payment_id",
        DROP COLUMN IF EXISTS "method"
    `);
  }
}
