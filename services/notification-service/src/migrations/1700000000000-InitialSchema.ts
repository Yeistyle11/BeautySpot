import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del notification-service: notificaciones y preferencias de envío. */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notifications_type_enum" AS ENUM ('APPOINTMENT_CONFIRMED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_COMPLETED', 'REVIEW_RECEIVED', 'MEMBERSHIP_INVITATION', 'PROMOTION');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notifications_channel_enum" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP', 'SMS');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "channel" character varying NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" "notifications_type_enum" NOT NULL,
        "channel" "notifications_channel_enum" NOT NULL,
        "title" character varying NOT NULL,
        "message" text NOT NULL,
        "data" jsonb,
        "read" boolean NOT NULL DEFAULT false,
        "sent_at" timestamp without time zone,
        CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_3fd2b9d9892539afb9ee3f5e0f"
      ON "notification_preferences" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_b1b5043ada10de525123ccdd40"
      ON "notifications" ("business_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_channel_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum"`);
  }
}
