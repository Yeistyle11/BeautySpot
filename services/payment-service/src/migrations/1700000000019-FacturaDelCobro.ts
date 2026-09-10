import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Enlaza la factura con el cobro del que salió, para poder responder de qué
 * cobro nació cada factura y si un cobro ya se facturó. El índice deja fuera
 * las anuladas: reemitir es la única forma de corregir una factura.
 */
export class FacturaDelCobro1700000000019 implements MigrationInterface {
  name = "FacturaDelCobro1700000000019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "payment_id" uuid
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_cobro"
      ON "invoices" ("payment_id")
      WHERE "payment_id" IS NOT NULL AND "status" <> 'CANCELLED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_invoices_cobro"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN IF EXISTS "payment_id"`
    );
  }
}
