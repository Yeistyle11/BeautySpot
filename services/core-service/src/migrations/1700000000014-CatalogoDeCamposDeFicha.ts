import { MigrationInterface, QueryRunner } from "typeorm";

/** Acota en la base el tipo de dato que puede pedir un campo de la ficha. */
export class CatalogoDeCamposDeFicha1700000000014 implements MigrationInterface {
  name = "CatalogoDeCamposDeFicha1700000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campos_de_ficha" ADD CONSTRAINT "CHK_campos_de_ficha_tipo"
        CHECK ("tipo" IN ('texto', 'numero', 'fecha', 'si_no', 'opciones'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campos_de_ficha"
        DROP CONSTRAINT IF EXISTS "CHK_campos_de_ficha_tipo"
    `);
  }
}
