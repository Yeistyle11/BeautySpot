import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fecha en la que el perfil llegó al escaparate, que es lo que mide «Recién
 * llegados»; la de creación de la fila nace con el borrador. Los ya publicados
 * se sellan con esa fecha, que es la única aproximación que hay.
 */
export class PublicacionDelPerfil1700000000011 implements MigrationInterface {
  name = "PublicacionDelPerfil1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_profiles"
      ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      UPDATE "business_profiles"
      SET "published_at" = "created_at"
      WHERE "is_published" = true AND "published_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_business_profiles_publicacion"
      ON "business_profiles" ("published_at")
      WHERE "published_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_business_profiles_publicacion"`
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "published_at"`
    );
  }
}
