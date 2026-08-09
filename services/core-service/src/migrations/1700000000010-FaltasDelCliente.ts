import { MigrationInterface, QueryRunner } from "typeorm";

/** Citas a las que el cliente no se presentó, para avisar al reservarle. */
export class FaltasDelCliente1700000000010 implements MigrationInterface {
  name = "FaltasDelCliente1700000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "no_show_count" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients" DROP COLUMN IF EXISTS "no_show_count"
    `);
  }
}
