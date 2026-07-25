import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del core-service: negocios, sedes, servicios, profesionales y clientes. */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branches" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "address" character varying,
        "city" character varying,
        "state" character varying,
        "country" character varying,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "phone" character varying,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_config" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "key" character varying NOT NULL,
        "value" jsonb NOT NULL,
        CONSTRAINT "PK_af2b2dc481572cfe5cf82f6258b" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_hours" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "branch_id" uuid,
        "day_of_week" integer NOT NULL,
        "open_time" character varying NOT NULL,
        "close_time" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_560a76077605005da835fe505a5" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "businesses" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "slug" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "logo" character varying,
        "cover_image" character varying,
        "phone" character varying,
        "email" character varying,
        "website" character varying,
        "address" character varying,
        "city" character varying,
        "state" character varying,
        "country" character varying,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "timezone" character varying NOT NULL DEFAULT 'America/Bogota',
        "currency" character varying NOT NULL DEFAULT 'COP',
        "locale" character varying NOT NULL DEFAULT 'es-CO',
        "businessType" character varying NOT NULL DEFAULT 'BELLEZA',
        "active" boolean NOT NULL DEFAULT true,
        "verified" boolean NOT NULL DEFAULT false,
        "planId" character varying,
        CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "user_id" uuid,
        "name" character varying NOT NULL,
        "email" character varying,
        "phone" character varying,
        "notes" text,
        "loyalty_points" integer NOT NULL DEFAULT '0',
        "tags" text,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_categories" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "icon" character varying,
        "color" character varying,
        "sort_order" integer NOT NULL DEFAULT '0',
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_00098887a508be8ef8b4fd6baf9" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_services" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "professional_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        "custom_price" numeric(10,2),
        "custom_duration" integer,
        CONSTRAINT "PK_0a792d3d12548bf1ae788f55654" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professionals" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "branch_id" uuid,
        "user_id" uuid,
        "name" character varying NOT NULL,
        "photo" character varying,
        "bio" text,
        "category" character varying,
        "category_id" uuid,
        "specialties" text NOT NULL,
        "years_exp" integer NOT NULL DEFAULT '0',
        "rating" numeric(3,2) NOT NULL DEFAULT '0',
        "total_reviews" integer NOT NULL DEFAULT '0',
        "portfolio" jsonb,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_d7dc8473b49fcd938def2799387" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_categories" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "icon" character varying,
        "color" character varying,
        "sort_order" integer NOT NULL DEFAULT '0',
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_fe4da5476c4ffe5aa2d3524ae68" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "services" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "duration" integer NOT NULL,
        "category" character varying NOT NULL,
        "category_id" uuid,
        "image" character varying,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "business_config" DROP CONSTRAINT IF EXISTS "UQ_762a60482dd3aa5780c688e4664"
    `);
    await queryRunner.query(`
      ALTER TABLE "business_config" ADD CONSTRAINT "UQ_762a60482dd3aa5780c688e4664" UNIQUE ("business_id", "key")
    `);

    await queryRunner.query(`
      ALTER TABLE "businesses" DROP CONSTRAINT IF EXISTS "UQ_82ca19bc20713fdfa72626a5da0"
    `);
    await queryRunner.query(`
      ALTER TABLE "businesses" ADD CONSTRAINT "UQ_82ca19bc20713fdfa72626a5da0" UNIQUE ("slug")
    `);

    await queryRunner.query(`
      ALTER TABLE "professional_services" DROP CONSTRAINT IF EXISTS "UQ_b3073a22d2e21fadf41fa8e2553"
    `);
    await queryRunner.query(`
      ALTER TABLE "professional_services" ADD CONSTRAINT "UQ_b3073a22d2e21fadf41fa8e2553" UNIQUE ("professional_id", "service_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_b6ac028866ef85f79f04581ef2"
      ON "branches" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_2725e2b0259d37e7d901a0a3e2"
      ON "business_config" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_469b226aa867f349ec8f1ebbe0"
      ON "business_hours" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_73c7fe72d1d6262ccbe62dae12"
      ON "clients" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_2055073fb3bb43b322f7a1a534"
      ON "clients" ("business_id", "phone")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_894e0211c8c1922ee5af79c957"
      ON "clients" ("business_id", "email")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_2953dcc926e5b16e906f1176cf"
      ON "professional_categories" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_67f3cf9ab66d103f6f77a6788b"
      ON "professional_categories" ("business_id", "active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_62222be17279aae4eb4e5fe0cb"
      ON "professionals" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_1ccfa6711fe9104a8fb1f07123"
      ON "professionals" ("business_id", "active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_054c835d58b30d0d07e5beaf78"
      ON "service_categories" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_27132b83087784249542c5f7fa"
      ON "service_categories" ("business_id", "active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_c591d6bbbe01010d8705127ba3"
      ON "services" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_78bb3360f59479811362595522"
      ON "services" ("business_id", "active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_76c9704a7e7804c2157ac25029"
      ON "services" ("business_id", "category")
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "FK_b6ac028866ef85f79f04581ef26"
    `);
    await queryRunner.query(`
      ALTER TABLE "branches" ADD CONSTRAINT "FK_b6ac028866ef85f79f04581ef26"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "business_config" DROP CONSTRAINT IF EXISTS "FK_2725e2b0259d37e7d901a0a3e25"
    `);
    await queryRunner.query(`
      ALTER TABLE "business_config" ADD CONSTRAINT "FK_2725e2b0259d37e7d901a0a3e25"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "business_hours" DROP CONSTRAINT IF EXISTS "FK_469b226aa867f349ec8f1ebbe05"
    `);
    await queryRunner.query(`
      ALTER TABLE "business_hours" ADD CONSTRAINT "FK_469b226aa867f349ec8f1ebbe05"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "FK_73c7fe72d1d6262ccbe62dae12d"
    `);
    await queryRunner.query(`
      ALTER TABLE "clients" ADD CONSTRAINT "FK_73c7fe72d1d6262ccbe62dae12d"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "professional_services" DROP CONSTRAINT IF EXISTS "FK_34a4319abc2199d0e68811d1824"
    `);
    await queryRunner.query(`
      ALTER TABLE "professional_services" ADD CONSTRAINT "FK_34a4319abc2199d0e68811d1824"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "professional_services" DROP CONSTRAINT IF EXISTS "FK_2fad8b472d2afd9af6c048b715c"
    `);
    await queryRunner.query(`
      ALTER TABLE "professional_services" ADD CONSTRAINT "FK_2fad8b472d2afd9af6c048b715c"
      FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "FK_62222be17279aae4eb4e5fe0cba"
    `);
    await queryRunner.query(`
      ALTER TABLE "professionals" ADD CONSTRAINT "FK_62222be17279aae4eb4e5fe0cba"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "FK_db07c39f0fbb152fc0be5d2781e"
    `);
    await queryRunner.query(`
      ALTER TABLE "professionals" ADD CONSTRAINT "FK_db07c39f0fbb152fc0be5d2781e"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "FK_2c05d1f596d214d8b8d8d690523"
    `);
    await queryRunner.query(`
      ALTER TABLE "professionals" ADD CONSTRAINT "FK_2c05d1f596d214d8b8d8d690523"
      FOREIGN KEY ("category_id") REFERENCES "professional_categories"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "FK_c591d6bbbe01010d8705127ba33"
    `);
    await queryRunner.query(`
      ALTER TABLE "services" ADD CONSTRAINT "FK_c591d6bbbe01010d8705127ba33"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "FK_1f8d1173481678a035b4a81a4ec"
    `);
    await queryRunner.query(`
      ALTER TABLE "services" ADD CONSTRAINT "FK_1f8d1173481678a035b4a81a4ec"
      FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "branches" DROP CONSTRAINT IF EXISTS "FK_b6ac028866ef85f79f04581ef26"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "business_config" DROP CONSTRAINT IF EXISTS "FK_2725e2b0259d37e7d901a0a3e25"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "business_hours" DROP CONSTRAINT IF EXISTS "FK_469b226aa867f349ec8f1ebbe05"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "clients" DROP CONSTRAINT IF EXISTS "FK_73c7fe72d1d6262ccbe62dae12d"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "professional_services" DROP CONSTRAINT IF EXISTS "FK_34a4319abc2199d0e68811d1824"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "professional_services" DROP CONSTRAINT IF EXISTS "FK_2fad8b472d2afd9af6c048b715c"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "professionals" DROP CONSTRAINT IF EXISTS "FK_62222be17279aae4eb4e5fe0cba"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "professionals" DROP CONSTRAINT IF EXISTS "FK_db07c39f0fbb152fc0be5d2781e"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "professionals" DROP CONSTRAINT IF EXISTS "FK_2c05d1f596d214d8b8d8d690523"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "services" DROP CONSTRAINT IF EXISTS "FK_c591d6bbbe01010d8705127ba33"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "services" DROP CONSTRAINT IF EXISTS "FK_1f8d1173481678a035b4a81a4ec"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "services"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professionals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_services"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "businesses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_hours"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches"`);
  }
}
