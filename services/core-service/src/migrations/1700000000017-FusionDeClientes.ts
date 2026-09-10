import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fusión de dos fichas del mismo cliente. La absorbida no se borra —sus citas y
 * facturas la referencian— sino que queda marcada apuntando a la superviviente,
 * y su contacto pasa a alias para que una reserva por él caiga en la buena.
 */
export class FusionDeClientes1700000000017 implements MigrationInterface {
  name = "FusionDeClientes1700000000017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
      ADD COLUMN IF NOT EXISTS "merged_into_id" uuid,
      ADD COLUMN IF NOT EXISTS "merged_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "alias_emails" text,
      ADD COLUMN IF NOT EXISTS "alias_phones" text
    `);

    // Las fichas fusionadas son minoría y se consultan por su superviviente.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_fusionadas"
      ON "clients" ("merged_into_id")
      WHERE "merged_into_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_clients_fusionadas"`);
    await queryRunner.query(`
      ALTER TABLE "clients"
      DROP COLUMN IF EXISTS "alias_phones",
      DROP COLUMN IF EXISTS "alias_emails",
      DROP COLUMN IF EXISTS "merged_at",
      DROP COLUMN IF EXISTS "merged_into_id"
    `);
  }
}
