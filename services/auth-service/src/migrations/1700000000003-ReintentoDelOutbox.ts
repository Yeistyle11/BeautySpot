import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Espera entre reintentos del outbox.
 *
 * Sin ella un fallo devolvía el mensaje a PENDING sin retraso ninguno, de modo
 * que una caída de RabbitMQ consumía los cinco intentos en segundos y daba por
 * muertos eventos que solo necesitaban esperar a que la cola volviera.
 *
 * La columna va vacía en los mensajes que nunca han fallado, que es lo que les
 * deja salir en el primer sondeo.
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
