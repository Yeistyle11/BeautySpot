import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Motivo tipificado de la cancelación, quién la hizo y cuándo. `cancel_reason`
 * se queda como la nota libre que acompaña al motivo.
 */
export class CancelacionTipificada1700000000008 implements MigrationInterface {
  name = "CancelacionTipificada1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD COLUMN IF NOT EXISTS "cancel_reason_type" character varying,
        ADD COLUMN IF NOT EXISTS "cancelled_by" uuid,
        ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancelled_by",
        DROP COLUMN IF EXISTS "cancel_reason_type"
    `);
  }
}
