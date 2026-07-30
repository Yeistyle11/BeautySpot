import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Corrige la numeración de facturas, que era por negocio pero con unicidad global.
 *
 * Cada negocio lleva su propia serie (`INV-{año}-{secuencia}`), de modo que dos
 * negocios emiten su primera factura con el mismo número. La tabla, en cambio,
 * exigía que el número fuese único en toda la plataforma: el segundo negocio que
 * facturara chocaba con un 23505 y no podía emitir.
 *
 * Se retira esa restricción —queda la de (business_id, number), que es la regla
 * real— y se añade la tabla de secuencias que sustituye al COUNT(*) con el que se
 * calculaba el número, que además daba el mismo a dos altas simultáneas.
 */
export class InvoiceNumberPerBusiness1700000000004 implements MigrationInterface {
  name = "InvoiceNumberPerBusiness1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP CONSTRAINT IF EXISTS "UQ_6b20aa66f2a835a4f2fbde48724"
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_sequences" (
        "business_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "last_number" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_invoice_sequences" PRIMARY KEY ("business_id", "year")
      )
    `);

    // Arranca cada serie donde la dejó la numeración anterior, para no repetir
    // un número ya emitido.
    await queryRunner.query(`
      INSERT INTO "invoice_sequences" ("business_id", "year", "last_number")
      SELECT "business_id",
             EXTRACT(YEAR FROM "created_at")::int,
             COUNT(*)
      FROM "invoices"
      GROUP BY "business_id", EXTRACT(YEAR FROM "created_at")::int
      ON CONFLICT ("business_id", "year") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_sequences"`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "UQ_6b20aa66f2a835a4f2fbde48724" UNIQUE ("number")
    `);
  }
}
