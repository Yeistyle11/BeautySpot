import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Añade `users.token_version`, la fuente autoritativa de invalidación de JWT.
 *
 * Antes la versión vivía solo en Redis, por lo que un flush o un failover
 * revalidaba tokens ya revocados (logout, cambio de contraseña). Redis pasa a
 * ser únicamente caché de esta columna.
 */
export class UserTokenVersion1700000000002 implements MigrationInterface {
  name = "UserTokenVersion1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"
    `);
  }
}
