import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices para las dos consultas habituales sobre reseñas.
 *
 * El listado de un negocio ordena siempre por fecha, y con solo el índice de
 * business_id Postgres tenía que leer todas sus reseñas y ordenarlas en memoria
 * en cada página. El alta, además, comprueba si la cita ya tiene reseña, lo que
 * sin índice recorría la tabla entera.
 */
export class ReviewQueryIndexes1700000000001 implements MigrationInterface {
  name = "ReviewQueryIndexes1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reviews_negocio_fecha"
      ON "reviews" ("business_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reviews_cita"
      ON "reviews" ("appointment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reviews_cita"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reviews_negocio_fecha"`);
  }
}
