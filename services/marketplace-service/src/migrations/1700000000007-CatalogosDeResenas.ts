import { MigrationInterface, QueryRunner } from "typeorm";

/** Acota en la base la visibilidad de una reseña y el motivo de su denuncia. */
export class CatalogosDeResenas1700000000007 implements MigrationInterface {
  name = "CatalogosDeResenas1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reviews" ADD CONSTRAINT "CHK_reviews_status"
        CHECK ("status" IN ('PUBLICADA', 'OCULTA'))
    `);
    await queryRunner.query(`
      ALTER TABLE "review_reports" ADD CONSTRAINT "CHK_review_reports_reason"
        CHECK ("reason" IN ('OFENSIVA', 'FALSA', 'SPAM', 'DATOS_PERSONALES', 'OTRO'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "review_reports"
        DROP CONSTRAINT IF EXISTS "CHK_review_reports_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "CHK_reviews_status"
    `);
  }
}
