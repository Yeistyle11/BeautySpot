import { MigrationInterface, QueryRunner } from "typeorm";

/** Reemplaza el token de reset en claro por su hash en la tabla password_resets. */
export class PasswordResetTokenHash1700000000001 implements MigrationInterface {
  name = "PasswordResetTokenHash1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "password_resets"
      RENAME COLUMN "token" TO "tokenHash"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_password_resets_token"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_password_resets_tokenHash"
      ON "password_resets"("tokenHash")
    `);

    await queryRunner.query(`
      DELETE FROM "password_resets"
      WHERE "usedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_password_resets_tokenHash"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_password_resets_token"
      ON "password_resets"("token")
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "password_resets"
      RENAME COLUMN "tokenHash" TO "token"
    `);
  }
}
