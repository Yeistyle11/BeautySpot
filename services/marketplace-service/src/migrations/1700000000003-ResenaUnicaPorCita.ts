import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hace único el índice de reseña por cita, para que lo decida la base y no un
 * `findOne` previo. Antes de crearlo hay que quedarse con una por cita: se
 * conserva la más antigua, que el negocio ya pudo responder.
 */
export class ResenaUnicaPorCita1700000000003 implements MigrationInterface {
  name = "ResenaUnicaPorCita1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "reviews" r
      USING "reviews" anterior
      WHERE r."appointment_id" IS NOT NULL
        AND r."appointment_id" = anterior."appointment_id"
        AND (anterior."created_at", anterior."id") < (r."created_at", r."id")
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reviews_cita"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_reviews_cita"
      ON "reviews" ("appointment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reviews_cita"`);
    await queryRunner.query(`
      CREATE INDEX "idx_reviews_cita" ON "reviews" ("appointment_id")
    `);
  }
}
