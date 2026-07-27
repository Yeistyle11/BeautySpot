import { MigrationInterface, QueryRunner } from "typeorm";

/** Marcas de cuándo se emitió cada recordatorio de una cita, para no repetirlos. */
export class AppointmentReminders1700000000003 implements MigrationInterface {
  name = "AppointmentReminders1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "reminder_24h_sent_at" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "reminder_1h_sent_at" timestamp without time zone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "reminder_24h_sent_at",
      DROP COLUMN IF EXISTS "reminder_1h_sent_at"
    `);
  }
}
