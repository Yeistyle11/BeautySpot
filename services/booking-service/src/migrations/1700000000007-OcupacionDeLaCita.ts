import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Reparto de la agenda dentro de la cita: cada línea guarda su posición y el
 * procesado y la limpieza con los que se reservó, y la cita hasta cuándo sigue
 * ocupado el profesional.
 *
 * Las filas existentes quedan con `orden` por antigüedad, sin procesado y con
 * `ocupado_hasta = end_time`.
 */
export class OcupacionDeLaCita1700000000007 implements MigrationInterface {
  name = "OcupacionDeLaCita1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointment_services"
        ADD COLUMN IF NOT EXISTS "orden" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "procesado_desde" integer,
        ADD COLUMN IF NOT EXISTS "procesado_minutos" integer,
        ADD COLUMN IF NOT EXISTS "buffer_despues" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "appointment_services" AS a
      SET "orden" = c.posicion - 1
      FROM (
        SELECT "id", row_number() OVER (
          PARTITION BY "appointment_id" ORDER BY "created_at", "id"
        ) AS posicion
        FROM "appointment_services"
      ) AS c
      WHERE a."id" = c."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "ocupado_hasta" character varying
    `);
    await queryRunner.query(`
      UPDATE "appointments" SET "ocupado_hasta" = "end_time" WHERE "ocupado_hasta" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments" DROP COLUMN IF EXISTS "ocupado_hasta"
    `);
    await queryRunner.query(`
      ALTER TABLE "appointment_services"
        DROP COLUMN IF EXISTS "buffer_despues",
        DROP COLUMN IF EXISTS "procesado_minutos",
        DROP COLUMN IF EXISTS "procesado_desde",
        DROP COLUMN IF EXISTS "orden"
    `);
  }
}
