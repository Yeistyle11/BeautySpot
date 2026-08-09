import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Guarda el desglose del impuesto en la propia factura.
 *
 * Antes solo se guardaba `total`, que era la suma de las líneas **sin** IVA,
 * mientras que el PDF asumía lo contrario y lo desglosaba hacia atrás
 * dividiendo entre 1,19. El subtotal y el impuesto impresos no cuadraban con
 * nada.
 *
 * El histórico se rellena con impuesto cero y `subtotal = total`: es lo que de
 * verdad se cobró. Recalcularlo al 19 % inventaría un impuesto que nadie
 * repercutió y descuadraría facturas ya entregadas.
 */
export class DesgloseDeIvaEnFacturas1700000000006 implements MigrationInterface {
  name = "DesgloseDeIvaEnFacturas1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN "subtotal" numeric(10,2),
      ADD COLUMN "tax_rate" numeric(5,4),
      ADD COLUMN "tax" numeric(10,2)
    `);

    await queryRunner.query(`
      UPDATE "invoices"
      SET "subtotal" = "total",
          "tax_rate" = 0,
          "tax" = 0
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ALTER COLUMN "subtotal" SET NOT NULL,
      ALTER COLUMN "tax_rate" SET NOT NULL,
      ALTER COLUMN "tax" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `total` vuelve a ser la base imponible, que es lo que representaba antes.
    await queryRunner.query(`UPDATE "invoices" SET "total" = "subtotal"`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN "subtotal",
      DROP COLUMN "tax_rate",
      DROP COLUMN "tax"
    `);
  }
}
