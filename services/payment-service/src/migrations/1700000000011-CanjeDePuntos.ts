import { MigrationInterface, QueryRunner } from "typeorm";

/** Puntos de fidelidad gastados en un cobro y el descuento que supusieron. */
export class CanjeDePuntos1700000000011 implements MigrationInterface {
  name = "CanjeDePuntos1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "puntos_usados" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "descuento" numeric(10,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "descuento"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "puntos_usados"
    `);
  }
}
