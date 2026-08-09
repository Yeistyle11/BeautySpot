import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Añade la confirmación de correo y el bloqueo por intentos fallidos.
 *
 * Las cuentas que ya existen quedan marcadas como verificadas: nunca recibieron
 * el correo de confirmación y exigírselo ahora las dejaría fuera.
 */
export class CuentasVerificadas1700000000002 implements MigrationInterface {
  name = "CuentasVerificadas1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verifications" (
        "id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        CONSTRAINT "UQ_7939cc2e493281f265179fa86ce" UNIQUE ("token_hash"),
        CONSTRAINT "PK_c1ea2921e767f83cd44c0af203f" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "email_verifications" DROP CONSTRAINT IF EXISTS "FK_c4f1838323ae1dff5aa00148915"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_verifications" ADD CONSTRAINT "FK_c4f1838323ae1dff5aa00148915"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "locked_until" timestamptz,
        ADD COLUMN IF NOT EXISTS "lockout_count" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "email_verifications" DROP CONSTRAINT IF EXISTS "FK_c4f1838323ae1dff5aa00148915"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verifications"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "lockout_count",
        DROP COLUMN IF EXISTS "locked_until",
        DROP COLUMN IF EXISTS "failed_login_attempts"
    `);
  }
}
