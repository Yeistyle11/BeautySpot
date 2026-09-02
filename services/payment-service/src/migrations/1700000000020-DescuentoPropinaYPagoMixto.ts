import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Descuento comercial, propina y reparto del cobro entre varios medios.
 *
 * El cobro solo sabía de un importe y un medio. El descuento que concedía el
 * negocio no se guardaba en ninguna parte —la columna `descuento` que ya
 * existe es lo que rebajaron los puntos canjeados, otra cosa—, la propina se
 * apuntaba en papel o se le regalaba al negocio, y «20.000 en efectivo y el
 * resto con tarjeta» obligaba a inventar dos cobros sueltos que hacían mentir
 * al conteo de ventas del día.
 *
 * Las columnas nuevas van a cero en los cobros que ya existen, y a cada uno se
 * le escribe su línea de reparto con el medio y el importe que ya tenía, para
 * que la caja y el arqueo lean de un solo sitio.
 */
export class DescuentoPropinaYPagoMixto1700000000020 implements MigrationInterface {
  name = "DescuentoPropinaYPagoMixto1700000000020";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "descuento_comercial" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "motivo_descuento" text,
      ADD COLUMN IF NOT EXISTS "propina" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "propina_profesional_id" uuid
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_splits" (
        "id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "payment_id" uuid NOT NULL,
        "method" character varying NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        CONSTRAINT "PK_payment_splits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_splits_cobro" FOREIGN KEY ("payment_id")
          REFERENCES "payments"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_payment_splits_method"
          CHECK ("method" IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_splits_cobro"
        ON "payment_splits" ("payment_id")
    `);

    // Cada cobro existente estrena su linea con lo que ya tenia.
    await queryRunner.query(`
      INSERT INTO "payment_splits" ("id", "payment_id", "method", "amount")
      SELECT gen_random_uuid(), p."id", p."method", p."amount"
      FROM "payments" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "payment_splits" s WHERE s."payment_id" = p."id"
      )
    `);

    // El cobro admite ahora la marca de reparto; los movimientos de caja no,
    // que cada uno entra por un medio concreto.
    await queryRunner.query(`
      ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "CHK_payments_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "CHK_payments_method"
        CHECK ("method" IN ('CASH', 'CARD', 'TRANSFER', 'OTHER', 'MIXED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Un cobro repartido no cabe en una sola columna: se le deja el medio de
    // su linea mayor antes de estrechar el catalogo.
    await queryRunner.query(`
      UPDATE "payments" p
      SET "method" = (
        SELECT s."method" FROM "payment_splits" s
        WHERE s."payment_id" = p."id"
        ORDER BY s."amount" DESC
        LIMIT 1
      )
      WHERE p."method" = 'MIXED'
        AND EXISTS (SELECT 1 FROM "payment_splits" s WHERE s."payment_id" = p."id")
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "CHK_payments_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "CHK_payments_method"
        CHECK ("method" IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'))
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "payment_splits"`);

    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "propina_profesional_id",
      DROP COLUMN IF EXISTS "propina",
      DROP COLUMN IF EXISTS "motivo_descuento",
      DROP COLUMN IF EXISTS "descuento_comercial"
    `);
  }
}
