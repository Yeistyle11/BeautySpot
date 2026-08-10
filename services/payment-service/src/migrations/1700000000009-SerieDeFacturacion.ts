import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Serie de numeración de las facturas, como tercera columna de la clave. Las
 * secuencias existentes quedan en la serie `INV`.
 */
export class SerieDeFacturacion1700000000009 implements MigrationInterface {
  name = "SerieDeFacturacion1700000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences"
        ADD COLUMN IF NOT EXISTS "serie" character varying NOT NULL DEFAULT 'INV'
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" DROP CONSTRAINT IF EXISTS "PK_invoice_sequences"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" DROP CONSTRAINT IF EXISTS "PK_9d5f0b1f0fd0f1e9b4c2f6bb5fa"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences"
        ADD CONSTRAINT "PK_invoice_sequences" PRIMARY KEY ("business_id", "serie", "year")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" DROP CONSTRAINT IF EXISTS "PK_invoice_sequences"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences" DROP COLUMN IF EXISTS "serie"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_sequences"
        ADD CONSTRAINT "PK_invoice_sequences" PRIMARY KEY ("business_id", "year")
    `);
  }
}
