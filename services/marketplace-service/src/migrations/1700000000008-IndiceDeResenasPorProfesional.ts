import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Indexa las reseñas por profesional. Es la columna por la que filtra el
 * listado del escaparate y por la que se recalcula la nota del profesional
 * cada vez que se crea, edita, borra o modera una reseña.
 */
export class IndiceDeResenasPorProfesional1700000000008 implements MigrationInterface {
  name = "IndiceDeResenasPorProfesional1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reviews_profesional"
      ON "reviews" ("professional_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reviews_profesional"`);
  }
}
