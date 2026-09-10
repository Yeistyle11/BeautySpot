import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Horas a las que la cita empezó y terminó de verdad, para poder contrastar la
 * duración estimada con la real. Las citas anteriores se quedan a null.
 */
export class HorasRealesDeLaCita1700000000006 implements MigrationInterface {
  name = "HorasRealesDeLaCita1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD COLUMN IF NOT EXISTS "started_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "completed_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        DROP COLUMN IF EXISTS "completed_at",
        DROP COLUMN IF EXISTS "started_at"
    `);
  }
}
