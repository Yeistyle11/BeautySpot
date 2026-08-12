import { MigrationInterface, QueryRunner } from "typeorm";

/** Una cita no puede tener dos cobros vivos a la vez. */
export class UnCobroPorCita1700000000012 implements MigrationInterface {
  name = "UnCobroPorCita1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Parcial por dos motivos: los cobros sueltos no llevan cita, y anular uno
    // tiene que dejar volver a cobrar la misma.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_cita_viva"
        ON "payments" ("business_id", "appointment_id")
        WHERE "appointment_id" IS NOT NULL
          AND status IN ('PENDING', 'COMPLETED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_payments_cita_viva"`);
  }
}
