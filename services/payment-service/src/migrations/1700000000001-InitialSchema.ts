import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del payment-service: pagos, facturas, líneas de factura y caja. */
export class InitialSchema1700000000001 implements MigrationInterface {
  name = "InitialSchema1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_method_enum" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invoices_status_enum" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "cash_movements_type_enum" AS ENUM ('IN', 'OUT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_movements" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "cash_session_id" uuid NOT NULL,
        "type" "cash_movements_type_enum" NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "concept" text NOT NULL,
        "registered_by" uuid NOT NULL,
        CONSTRAINT "PK_25faead19e1ff74153a01604d37" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_sessions" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "branch_id" uuid,
        "opened_by" uuid NOT NULL,
        "closed_by" uuid,
        "opening_amount" numeric(10,2) NOT NULL,
        "closing_amount" numeric(10,2),
        "opened_at" timestamp without time zone NOT NULL,
        "closed_at" timestamp without time zone,
        "notes" text,
        CONSTRAINT "PK_946ea5ce864b10fb70162708448" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_items" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "invoice_id" uuid NOT NULL,
        "description" text NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price" numeric(10,2) NOT NULL,
        "total" numeric(10,2) NOT NULL,
        CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "client_id" uuid NOT NULL,
        "number" character varying NOT NULL,
        "date" date NOT NULL,
        "due_date" date NOT NULL,
        "total" numeric(10,2) NOT NULL,
        "status" "invoices_status_enum" NOT NULL DEFAULT 'DRAFT',
        "notes" text,
        CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "appointment_id" uuid,
        "client_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "method" "payments_method_enum" NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'COMPLETED',
        "reference" character varying,
        "notes" text,
        "registered_by" uuid,
        "refunded_at" timestamp without time zone,
        "refund_amount" numeric(10,2),
        "refund_reason" text,
        "refunded_by" character varying(100),
        CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "UQ_6b20aa66f2a835a4f2fbde48724"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" ADD CONSTRAINT "UQ_6b20aa66f2a835a4f2fbde48724" UNIQUE ("number")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_db9ece007abafa28791ea3b264"
      ON "cash_sessions" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_8f96c84343bd7d6cb4374e9788"
      ON "invoices" ("business_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cb5fdc668fe792f35173df9f52"
      ON "invoices" ("business_id", "number")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_07889d42d0b29705cf4a649576"
      ON "payments" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_5b3d16c327c6c4e5af54d87adb"
      ON "payments" ("business_id", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_movements" DROP CONSTRAINT IF EXISTS "FK_fa6a0c146567090acf8a03e01c2"
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_movements" ADD CONSTRAINT "FK_fa6a0c146567090acf8a03e01c2"
      FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "FK_dc991d555664682cfe892eea2c1"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_dc991d555664682cfe892eea2c1"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "cash_movements" DROP CONSTRAINT IF EXISTS "FK_fa6a0c146567090acf8a03e01c2"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "invoice_items" DROP CONSTRAINT IF EXISTS "FK_dc991d555664682cfe892eea2c1"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_movements"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cash_movements_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "invoices_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_method_enum"`);
  }
}
