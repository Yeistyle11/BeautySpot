import { MigrationInterface, QueryRunner } from "typeorm";

/** Acota en la base el motivo con el que se cancela una cita. */
export class CatalogoDeCancelacion1700000000012 implements MigrationInterface {
  name = "CatalogoDeCancelacion1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD CONSTRAINT "CHK_appointments_cancel_reason_type"
        CHECK ("cancel_reason_type" IS NULL OR "cancel_reason_type" IN (
          'CLIENTE_CANCELA', 'NEGOCIO_CANCELA', 'PROFESIONAL_NO_DISPONIBLE',
          'DUPLICADA', 'OTRO'
        ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        DROP CONSTRAINT IF EXISTS "CHK_appointments_cancel_reason_type"
    `);
  }
}
