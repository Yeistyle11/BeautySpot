import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Horas a las que la cita empezó y terminó de verdad. Sin ellas no hay forma de
 * contrastar la duración estimada de un servicio con la que de verdad lleva.
 *
 * Las citas anteriores se quedan a null: la hora real no se puede reconstruir.
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
