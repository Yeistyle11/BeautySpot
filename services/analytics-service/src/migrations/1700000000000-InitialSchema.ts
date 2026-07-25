import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del analytics-service: métricas diarias y por profesional. */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_metrics" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "date" date NOT NULL,
        "total_appointments" integer NOT NULL DEFAULT '0',
        "completed_appointments" integer NOT NULL DEFAULT '0',
        "cancelled_appointments" integer NOT NULL DEFAULT '0',
        "no_show_appointments" integer NOT NULL DEFAULT '0',
        "total_revenue" numeric(12,2) NOT NULL DEFAULT '0',
        "new_clients" integer NOT NULL DEFAULT '0',
        "returning_clients" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_0b33a3faffa5fbb3d4dad78c4e9" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_metrics" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "date" date NOT NULL,
        "appointments" integer NOT NULL DEFAULT '0',
        "revenue" numeric(12,2) NOT NULL DEFAULT '0',
        "rating" numeric(3,2) NOT NULL DEFAULT '0',
        "avg_service_time" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_112f2449ce345650420f191217a" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_f40f9f6aad06d24e79bf974c29"
      ON "daily_metrics" ("business_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b7f06f1d52ae4cb28d8760dcce"
      ON "daily_metrics" ("business_id", "date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_9f1c0add5ec7861a8aed8597c8"
      ON "professional_metrics" ("business_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_3ffb7c06f088d1fc67e25b9bba"
      ON "professional_metrics" ("business_id", "professional_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_metrics"`);
  }
}
