import { MigrationInterface, QueryRunner } from "typeorm";

/** Fecha de nacimiento del cliente y marca del año en que ya se le felicitó. */
export class CumpleanosDelCliente1700000000011 implements MigrationInterface {
  name = "CumpleanosDelCliente1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "birth_date" date,
        ADD COLUMN IF NOT EXISTS "birthday_greeted_year" smallint
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_cumpleanos"
      ON "clients" ("birth_date")
      WHERE "birth_date" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_clients_cumpleanos"`);
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "birthday_greeted_year",
        DROP COLUMN IF EXISTS "birth_date"
    `);
  }
}
