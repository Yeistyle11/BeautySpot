import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Traza de la corrección de un cobro: quién la hizo y por qué, igual que la
 * deja una devolución. Las tres columnas van vacías en los cobros que nadie ha
 * corregido.
 */
export class CorreccionDeCobros1700000000018 implements MigrationInterface {
  name = "CorreccionDeCobros1700000000018";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "edited_by" uuid,
      ADD COLUMN IF NOT EXISTS "edit_reason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "edit_reason",
      DROP COLUMN IF EXISTS "edited_by",
      DROP COLUMN IF EXISTS "edited_at"
    `);
  }
}
