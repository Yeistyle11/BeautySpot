import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ficha del cliente que cada negocio se define: los campos en su propia tabla y
 * los valores en un jsonb del cliente.
 *
 * No son columnas fijas porque una barbería y un centro estético no piden lo
 * mismo, y añadir un campo no debería costar una migración.
 */
export class FichaDelCliente1700000000008 implements MigrationInterface {
  name = "FichaDelCliente1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "campos_de_ficha" (
        "id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "etiqueta" character varying NOT NULL,
        "tipo" character varying NOT NULL DEFAULT 'texto',
        "opciones" jsonb,
        "obligatorio" boolean NOT NULL DEFAULT false,
        "orden" integer NOT NULL DEFAULT 0,
        "service_ids" jsonb,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_fb07460e3d163d3b40f7f6ad254" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_44e20e33b7a69a6d5f86ca2986"
      ON "campos_de_ficha" ("business_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_610a52713b47be295268bacc11"
      ON "campos_de_ficha" ("business_id", "active")
    `);

    await queryRunner.query(`
      ALTER TABLE "campos_de_ficha" DROP CONSTRAINT IF EXISTS "FK_44e20e33b7a69a6d5f86ca29867"
    `);
    await queryRunner.query(`
      ALTER TABLE "campos_de_ficha" ADD CONSTRAINT "FK_44e20e33b7a69a6d5f86ca29867"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "ficha" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "campos_de_ficha" DROP CONSTRAINT IF EXISTS "FK_44e20e33b7a69a6d5f86ca29867"
    `);
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN IF EXISTS "ficha"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "campos_de_ficha"`);
  }
}
