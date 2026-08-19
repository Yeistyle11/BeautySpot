import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Acota en la base los catálogos que se guardan como texto: método y estado del
 * cobro, estado de la factura, y tipo y método del movimiento de caja.
 */
export class CatalogosAcotados1700000000015 implements MigrationInterface {
  name = "CatalogosAcotados1700000000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "CHK_payments_method"
        CHECK ("method" IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'))
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "CHK_payments_status"
        CHECK ("status" IN ('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED'))
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "CHK_invoices_status"
        CHECK ("status" IN ('DRAFT', 'SENT', 'PAID', 'CANCELLED'))
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_movements" ADD CONSTRAINT "CHK_cash_movements_type"
        CHECK ("type" IN ('IN', 'OUT'))
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_movements" ADD CONSTRAINT "CHK_cash_movements_method"
        CHECK ("method" IS NULL OR "method" IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_movements" DROP CONSTRAINT IF EXISTS "CHK_cash_movements_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_movements" DROP CONSTRAINT IF EXISTS "CHK_cash_movements_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "CHK_invoices_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "CHK_payments_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "CHK_payments_method"
    `);
  }
}
