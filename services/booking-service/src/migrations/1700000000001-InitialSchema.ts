import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del booking-service: citas, servicios de la cita, disponibilidad y bloqueos. */
export class InitialSchema1700000000001 implements MigrationInterface {
  name = "InitialSchema1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "appointments_status_enum" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointment_services" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "appointment_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        "service_name" character varying NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "duration" integer NOT NULL,
        CONSTRAINT "PK_8423f59b66c157533b4df8b0459" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "created_by" uuid,
        "updated_by" uuid,
        "branch_id" uuid,
        "client_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "date" date NOT NULL,
        "start_time" character varying NOT NULL,
        "end_time" character varying NOT NULL,
        "status" "appointments_status_enum" NOT NULL DEFAULT 'PENDING',
        "notes" character varying,
        "cancel_reason" character varying,
        "points_earned" integer NOT NULL DEFAULT '0',
        "totalAmount" numeric(10,2) NOT NULL DEFAULT '0',
        CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "availabilities" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "day_of_week" integer NOT NULL,
        "start_time" character varying NOT NULL,
        "end_time" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_9562bd8681d40361b1a124ea52c" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blocked_slots" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "date" date NOT NULL,
        "start_time" character varying NOT NULL,
        "end_time" character varying NOT NULL,
        "reason" character varying,
        CONSTRAINT "PK_695a263308f46c2fb48fec80fb3" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "appointment_services" DROP CONSTRAINT IF EXISTS "UQ_0d8cb48b88882567f9bd788b1a0"
    `);
    await queryRunner.query(`
      ALTER TABLE "appointment_services" ADD CONSTRAINT "UQ_0d8cb48b88882567f9bd788b1a0" UNIQUE ("appointment_id", "service_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_1496c752231bd35c97041862bd"
      ON "appointments" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cc3afe73a96bb33f3fb43cca06"
      ON "appointments" ("business_id", "professional_id", "date", "start_time")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_2ff8bd02ebeb1f0f5aa6856817"
      ON "appointments" ("professional_id", "date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fdb4595f7b96f48b7509e5f449"
      ON "appointments" ("business_id", "date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_7b4c4abfb4486571e8d72e8e22"
      ON "availabilities" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_910b6c7df5546d00b16e36aa04"
      ON "availabilities" ("business_id", "professional_id", "day_of_week")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bb5c6b7c7fd20f2863368bd82d"
      ON "blocked_slots" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_c299556fc4984551f61c5b5a97"
      ON "blocked_slots" ("business_id", "professional_id", "date")
    `);

    await queryRunner.query(`
      ALTER TABLE "appointment_services" DROP CONSTRAINT IF EXISTS "FK_923e323e598280a0454e1d1b7cf"
    `);
    await queryRunner.query(`
      ALTER TABLE "appointment_services" ADD CONSTRAINT "FK_923e323e598280a0454e1d1b7cf"
      FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "appointment_services" DROP CONSTRAINT IF EXISTS "FK_923e323e598280a0454e1d1b7cf"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "blocked_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "availabilities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment_services"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appointments_status_enum"`);
  }
}
