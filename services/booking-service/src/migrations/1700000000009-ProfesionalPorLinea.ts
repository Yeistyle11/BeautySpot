import { MigrationInterface, QueryRunner } from "typeorm";

/** Profesional propio de cada línea de la cita; nulo = el titular. */
export class ProfesionalPorLinea1700000000009 implements MigrationInterface {
  name = "ProfesionalPorLinea1700000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointment_services"
        ADD COLUMN IF NOT EXISTS "professional_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointment_services" DROP COLUMN IF EXISTS "professional_id"
    `);
  }
}
