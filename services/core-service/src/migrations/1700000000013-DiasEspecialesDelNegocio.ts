import { MigrationInterface, QueryRunner } from "typeorm";

/** Festivos, vacaciones y jornadas con horario propio del negocio. */
export class DiasEspecialesDelNegocio1700000000013 implements MigrationInterface {
  name = "DiasEspecialesDelNegocio1700000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_special_days" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "business_id" uuid NOT NULL,
        "branch_id" uuid,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "closed" boolean NOT NULL DEFAULT true,
        "open_time" character varying(5),
        "close_time" character varying(5),
        "motivo" character varying(120) NOT NULL,
        CONSTRAINT "PK_business_special_days" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_special_days_rango" CHECK ("end_date" >= "start_date")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_special_days_negocio_rango"
      ON "business_special_days" ("business_id", "start_date", "end_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_special_days_negocio_rango"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "business_special_days"`);
  }
}
