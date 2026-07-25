import { MigrationInterface, QueryRunner } from "typeorm";

/** Esquema inicial del marketplace-service: perfiles públicos, reseñas y outbox. */
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
      CREATE TABLE IF NOT EXISTS "business_profiles" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "logo" character varying,
        "cover_image" character varying,
        "phone" character varying,
        "email" character varying,
        "address" text,
        "city" character varying,
        "state" character varying,
        "country" character varying,
        "lat" numeric(10,7),
        "lng" numeric(10,7),
        "rating" numeric(3,2) NOT NULL DEFAULT '0',
        "total_reviews" integer NOT NULL DEFAULT '0',
        "business_type" character varying,
        "active" boolean NOT NULL DEFAULT true,
        "verified" boolean NOT NULL DEFAULT false,
        "tagline" character varying(80),
        "story_title" character varying(100),
        "story_text" text,
        "story_image" character varying,
        "founded_year" integer,
        "founders" character varying,
        "social_links" jsonb,
        "section_config" jsonb,
        "gallery_images" jsonb,
        "is_published" boolean NOT NULL DEFAULT false,
        "profile_completeness" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_29525485b1db8e87caf6a5ef042" PRIMARY KEY ("id")
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
      CREATE TABLE IF NOT EXISTS "professional_profiles" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "photo" character varying,
        "bio" text,
        "specialties" text NOT NULL,
        "years_exp" integer NOT NULL DEFAULT '0',
        "tagline" character varying,
        "portfolio" jsonb,
        "social_instagram" character varying,
        "slug" character varying,
        "visible_on_profile" boolean NOT NULL DEFAULT true,
        "rating" numeric(3,2) NOT NULL DEFAULT '0',
        "total_reviews" integer NOT NULL DEFAULT '0',
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_b2140d2f56b0910e4c58ab4d2a2" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "review_helpful" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "review_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_357fdd46b34876b94a72cb566f7" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "appointment_id" uuid,
        "client_id" uuid NOT NULL,
        "professional_id" uuid,
        "rating" integer NOT NULL,
        "comment" text,
        "response" text,
        "responded_at" timestamp without time zone,
        "service_name" character varying,
        "professional_name" character varying,
        "photos" jsonb,
        "is_verified" boolean NOT NULL DEFAULT false,
        "helpful_count" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "business_profiles" DROP CONSTRAINT IF EXISTS "UQ_5f66561947eba2379b1cff44370"
    `);
    await queryRunner.query(`
      ALTER TABLE "business_profiles" ADD CONSTRAINT "UQ_5f66561947eba2379b1cff44370" UNIQUE ("slug")
    `);

    await queryRunner.query(`
      ALTER TABLE "professional_profiles" DROP CONSTRAINT IF EXISTS "UQ_7b60836cf551628c1c76727f3ba"
    `);
    await queryRunner.query(`
      ALTER TABLE "professional_profiles" ADD CONSTRAINT "UQ_7b60836cf551628c1c76727f3ba" UNIQUE ("slug")
    `);

    await queryRunner.query(`
      ALTER TABLE "review_helpful" DROP CONSTRAINT IF EXISTS "UQ_636e9a5efc3e4f3126a72f20c5e"
    `);
    await queryRunner.query(`
      ALTER TABLE "review_helpful" ADD CONSTRAINT "UQ_636e9a5efc3e4f3126a72f20c5e" UNIQUE ("review_id", "user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_3d5311aa214e5b6034286d09b4"
      ON "business_profiles" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_a4940f7152fe2612f701842e5a"
      ON "business_profiles" ("city")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_200c9c020d81a5cc2914c0eab8"
      ON "business_profiles" ("active", "is_published")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_messages_status_created_at"
      ON "outbox_messages" ("status", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_51e90f5d90b05f2c9bafa688cb"
      ON "professional_profiles" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_8d422f2cb970f865e661bf3823"
      ON "professional_profiles" ("professional_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_5487461baf5ad075430309fb8e"
      ON "reviews" ("business_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_d4e7e923e6bb78a8f0add75449"
      ON "reviews" ("client_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review_helpful"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_profiles"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "outbox_messages_status_enum"`
    );
  }
}
