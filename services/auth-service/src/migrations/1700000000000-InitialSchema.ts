import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del auth-service: usuarios, membresías, resets de contraseña, auditoría y outbox. */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "outbox_messages_status_enum" AS ENUM ('PENDING', 'PROCESSED', 'DEAD');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "memberships_role_enum" AS ENUM ('SUPER_ADMIN', 'OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTIONIST', 'CLIENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "action" character varying NOT NULL,
        "entity" character varying NOT NULL,
        "entity_id" uuid,
        "changes" jsonb,
        "ip" character varying,
        "user_agent" character varying,
        CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memberships" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "memberships_role_enum" NOT NULL DEFAULT 'CLIENT',
        "active" boolean NOT NULL DEFAULT true,
        "invited_by" uuid,
        "accepted_at" timestamp without time zone,
        CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_messages" (
        "id" uuid NOT NULL,
        "aggregate_type" character varying(100) NOT NULL,
        "aggregate_id" character varying(100) NOT NULL,
        "event_type" character varying(200) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_messages_status_enum" NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT '0',
        "last_error" text,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "processed_at" timestamp without time zone,
        CONSTRAINT "PK_0171348f527c64b137e4d4f5b66" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_resets" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" timestamp without time zone NOT NULL,
        "used_at" timestamp without time zone,
        CONSTRAINT "PK_4816377aa98211c1de34469e742" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "name" character varying NOT NULL,
        "phone" character varying,
        "avatar" character varying,
        "email_verified" boolean NOT NULL DEFAULT false,
        "active" boolean NOT NULL DEFAULT true,
        "current_business_id" uuid,
        "token_version" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "UQ_7b4257df400c240f4e79ba60c89"
    `);
    await queryRunner.query(`
      ALTER TABLE "memberships" ADD CONSTRAINT "UQ_7b4257df400c240f4e79ba60c89" UNIQUE ("user_id", "business_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "password_resets" DROP CONSTRAINT IF EXISTS "UQ_323290a9239ad3d397ad78018ec"
    `);
    await queryRunner.query(`
      ALTER TABLE "password_resets" ADD CONSTRAINT "UQ_323290a9239ad3d397ad78018ec" UNIQUE ("token_hash")
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ea5f8019ae03860d8f5fec3e3c"
      ON "memberships" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_messages_status_created_at"
      ON "outbox_messages" ("status", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "FK_7c1e2fdfed4f6838e0c05ae5051"
    `);
    await queryRunner.query(`
      ALTER TABLE "memberships" ADD CONSTRAINT "FK_7c1e2fdfed4f6838e0c05ae5051"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "password_resets" DROP CONSTRAINT IF EXISTS "FK_f7a4c3bc48f24df007936d217be"
    `);
    await queryRunner.query(`
      ALTER TABLE "password_resets" ADD CONSTRAINT "FK_f7a4c3bc48f24df007936d217be"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "memberships" DROP CONSTRAINT IF EXISTS "FK_7c1e2fdfed4f6838e0c05ae5051"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "password_resets" DROP CONSTRAINT IF EXISTS "FK_f7a4c3bc48f24df007936d217be"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_resets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "memberships_role_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "outbox_messages_status_enum"`
    );
  }
}
