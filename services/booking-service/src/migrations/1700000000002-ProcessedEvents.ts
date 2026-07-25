import { MigrationInterface, QueryRunner } from "typeorm";

/** Tabla que registra qué eventos ha aplicado ya cada handler de este servicio. */
export class ProcessedEvents1700000000002 implements MigrationInterface {
  name = "ProcessedEvents1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_events" (
        "event_id" uuid NOT NULL,
        "handler" character varying(200) NOT NULL,
        "event_type" character varying(200) NOT NULL,
        "processed_at" timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ab834790da713dd72b4df649c0b" PRIMARY KEY ("event_id", "handler")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_events"`);
  }
}
