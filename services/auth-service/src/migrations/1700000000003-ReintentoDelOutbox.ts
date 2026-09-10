import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Espera entre reintentos del outbox, para que una caída de RabbitMQ no gaste
 * los cinco intentos en segundos. Va vacía en los mensajes que nunca han
 * fallado, que salen en el primer sondeo.
 */
export class ReintentoDelOutbox1700000000003 implements MigrationInterface {
  name = "ReintentoDelOutbox1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_messages"
      ADD COLUMN IF NOT EXISTS "next_attempt_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_messages_status_next_attempt"
      ON "outbox_messages" ("status", "next_attempt_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_outbox_messages_status_next_attempt"`
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_messages" DROP COLUMN IF EXISTS "next_attempt_at"`
    );
  }
}
