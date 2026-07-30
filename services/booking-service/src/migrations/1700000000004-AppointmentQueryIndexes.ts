import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices para las dos consultas de citas que no arrancan por business_id: el
 * barrido por fecha del worker de recordatorios —parcial sobre las citas vivas
 * a las que les falta algún aviso— y el listado de "mis citas" por client_id.
 */
export class AppointmentQueryIndexes1700000000004 implements MigrationInterface {
  name = "AppointmentQueryIndexes1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_recordatorios"
      ON "appointments" ("date")
      WHERE "status" IN ('PENDING', 'CONFIRMED')
        AND ("reminder_24h_sent_at" IS NULL OR "reminder_1h_sent_at" IS NULL)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_cliente_fecha"
      ON "appointments" ("client_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_appointments_cliente_fecha"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_appointments_recordatorios"`
    );
  }
}
