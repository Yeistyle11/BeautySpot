import { MigrationInterface, QueryRunner } from "typeorm";

/** Cobros del día, que es el divisor del ticket medio. */
export class VentasDelDia1700000000005 implements MigrationInterface {
  name = "VentasDelDia1700000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "daily_metrics"
        ADD COLUMN IF NOT EXISTS "ventas" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "daily_metrics" DROP COLUMN IF EXISTS "ventas"
    `);
  }
}
