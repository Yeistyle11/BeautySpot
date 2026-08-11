import { MigrationInterface, QueryRunner } from "typeorm";

/** Serie que agrupa los bloqueos creados de una vez con una repetición. */
export class SerieDeBloqueos1700000000010 implements MigrationInterface {
  name = "SerieDeBloqueos1700000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blocked_slots"
        ADD COLUMN IF NOT EXISTS "serie_id" uuid
    `);
    // Levantar la serie entera es una consulta por este campo, no por fecha.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_blocked_slots_serie"
        ON "blocked_slots" ("serie_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_blocked_slots_serie"`);
    await queryRunner.query(`
      ALTER TABLE "blocked_slots" DROP COLUMN IF EXISTS "serie_id"
    `);
  }
}
