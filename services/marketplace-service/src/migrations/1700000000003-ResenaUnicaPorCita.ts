import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hace único el índice de reseña por cita.
 *
 * La unicidad se comprobaba solo con un `findOne` previo, así que dos altas
 * simultáneas sobre la misma cita pasaban las dos. Ahora la decide la base.
 *
 * Antes de crearlo hay que quedarse con una reseña por cita: se conserva la más
 * antigua, que es la que el negocio ya pudo haber respondido.
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
