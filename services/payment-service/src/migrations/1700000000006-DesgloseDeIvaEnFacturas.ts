import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Guarda el desglose del impuesto en la propia factura, en vez de deducirlo del
 * total al imprimir el PDF.
 *
 * Las facturas ya emitidas se rellenan con impuesto cero y `subtotal = total`,
 * que es lo que de verdad se cobró: aplicarles el 19 % repercutiría un impuesto
 * que nadie pagó y descuadraría documentos ya entregados.
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
    // Sin las columnas de desglose, `total` vuelve a ser la base imponible.
    await queryRunner.query(`UPDATE "invoices" SET "total" = "subtotal"`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN "subtotal",
      DROP COLUMN "tax_rate",
      DROP COLUMN "tax"
    `);
  }
}
