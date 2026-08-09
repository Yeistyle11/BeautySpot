import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Añade el documento de identidad del cliente, con el que la factura identifica
 * al receptor.
 *
 * Es nullable porque el invitado que reserva desde el marketplace no lo aporta:
 * en ese caso la factura lo deja en blanco, que es más honesto que un dato
 * falso.
 */
export class DocumentoDeCliente1700000000004 implements MigrationInterface {
  name = "DocumentoDeCliente1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients" ADD COLUMN "documento" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "documento"`);
  }
}
