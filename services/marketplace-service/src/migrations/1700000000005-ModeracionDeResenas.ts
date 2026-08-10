import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Visibilidad de la reseña y denuncias de los usuarios. Las reseñas existentes
 * quedan publicadas.
 */
export class ModeracionDeResenas1700000000005 implements MigrationInterface {
  name = "ModeracionDeResenas1700000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "review_reports" (
        "id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "review_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "reason" character varying NOT NULL,
        "detalle" text,
        CONSTRAINT "UQ_5bf1b6c5a451b49235aadff6bcd" UNIQUE ("review_id", "user_id"),
        CONSTRAINT "PK_173974ee185c21487767bdb54dc" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_207877d200ea358e05ab4d7033"
      ON "review_reports" ("review_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "reviews"
        ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'PUBLICADA',
        ADD COLUMN IF NOT EXISTS "report_count" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews"
        DROP COLUMN IF EXISTS "report_count",
        DROP COLUMN IF EXISTS "status"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "review_reports"`);
  }
}
