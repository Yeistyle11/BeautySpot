import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Un negocio tiene como mucho un perfil en el marketplace.
 *
 * El alta comprueba antes si ya existe, pero esa comprobación y la escritura no
 * son atómicas: dos peticiones a la vez crean dos filas y a partir de ahí el
 * panel carga una al azar, con la galería y la historia repartidas entre las
 * dos. La decide la base, como el resto de invariantes del proyecto.
 *
 * Antes de crearlo hay que quedarse con un perfil por negocio: se conserva el
 * más antiguo, que es el que ya puede estar publicado y enlazado por su slug.
 */
export class PerfilUnicoPorNegocio1700000000006 implements MigrationInterface {
  name = "PerfilUnicoPorNegocio1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "business_profiles" p
      USING "business_profiles" anterior
      WHERE p."business_id" = anterior."business_id"
        AND (anterior."created_at", anterior."id") < (p."created_at", p."id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_business_profiles_negocio"
      ON "business_profiles" ("business_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_business_profiles_negocio"`
    );
  }
}
