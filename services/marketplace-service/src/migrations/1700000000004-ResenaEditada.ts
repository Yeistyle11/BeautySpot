import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Marca de la última edición del autor sobre su reseña. Se expone al leerla,
 * para que no parezca que siempre dijo lo que dice ahora.
 */
export class ResenaEditada1700000000004 implements MigrationInterface {
  name = "ResenaEditada1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "edited_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews" DROP COLUMN IF EXISTS "edited_at"
    `);
  }
}
