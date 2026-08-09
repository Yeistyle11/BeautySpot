import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Marca del ejercicio del derecho de supresión sobre un cliente. La fila se
 * conserva con los datos personales vaciados en vez de borrarse: sus citas y
 * facturas son documentos contables que tienen que seguir cuadrando.
 */
export class AnonimizarCliente1700000000007 implements MigrationInterface {
  name = "AnonimizarCliente1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "anonymized_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients" DROP COLUMN IF EXISTS "anonymized_at"
    `);
  }
}
