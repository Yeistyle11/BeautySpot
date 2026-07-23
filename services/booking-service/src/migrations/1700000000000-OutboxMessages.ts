import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tabla del patrón Outbox transaccional para booking-service.
 *
 * Los eventos de dominio (cita creada/completada/cancelada) se persisten en la
 * misma transacción que el cambio de estado y los publica después el
 * OutboxRelayWorker, de modo que un rollback nunca deja un evento emitido sin
 * su cambio ni viceversa (dual-write).
 */
export class OutboxMessages1700000000000 implements MigrationInterface {
  name = "OutboxMessages1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "outbox_messages_status_enum" AS ENUM ('PENDING', 'PROCESSED', 'DEAD');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_messages" (
        "id" uuid PRIMARY KEY NOT NULL,
        "aggregate_type" varchar(100) NOT NULL,
        "aggregate_id" varchar(100) NOT NULL,
        "event_type" varchar(200) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_messages_status_enum" NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "last_error" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_messages_status_created_at"
      ON "outbox_messages" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_messages"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "outbox_messages_status_enum"`
    );
  }
}
