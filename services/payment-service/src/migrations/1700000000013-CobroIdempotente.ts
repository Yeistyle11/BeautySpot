import { MigrationInterface, QueryRunner } from "typeorm";

/** El mismo intento de cobro, enviado dos veces, deja un solo cargo. */
export class CobroIdempotente1700000000013 implements MigrationInterface {
  name = "CobroIdempotente1700000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "solicitud_id" uuid
    `);

    // Parcial porque los cobros anteriores a esta columna no traen
    // identificador, y todos ellos serían el mismo valor nulo.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_solicitud"
        ON "payments" ("business_id", "solicitud_id")
        WHERE "solicitud_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_payments_solicitud"`);
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "solicitud_id"
    `);
  }
}
