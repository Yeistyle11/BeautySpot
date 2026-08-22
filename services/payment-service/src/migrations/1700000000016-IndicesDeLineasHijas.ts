import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Indexa las dos claves ajenas por las que se leen las líneas de un padre:
 * los movimientos de una sesión de caja y las líneas de una factura. Postgres
 * no indexa las claves ajenas por su cuenta, así que sin esto el arqueo y cada
 * factura recorren la tabla entera.
 */
export class IndicesDeLineasHijas1700000000016 implements MigrationInterface {
  name = "IndicesDeLineasHijas1700000000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cash_movements_sesion"
      ON "cash_movements" ("cash_session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_items_factura"
      ON "invoice_items" ("invoice_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoice_items_factura"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cash_movements_sesion"`);
  }
}
