import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Un negocio tiene como mucho un perfil en el marketplace. Antes de crear el
 * indice se conserva el mas antiguo de los que hubiera.
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
