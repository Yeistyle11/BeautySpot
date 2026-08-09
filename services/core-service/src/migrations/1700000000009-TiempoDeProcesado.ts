import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tiempo de procesado y limpieza de cada servicio: la ventana dentro de la
 * duración en que el profesional queda libre, y los minutos que sigue ocupado
 * tras irse la clienta. Nulos y cero dejan el servicio ocupando su bloque entero.
 */
export class TiempoDeProcesado1700000000009 implements MigrationInterface {
  name = "TiempoDeProcesado1700000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        ADD COLUMN IF NOT EXISTS "procesado_desde" integer,
        ADD COLUMN IF NOT EXISTS "procesado_minutos" integer,
        ADD COLUMN IF NOT EXISTS "buffer_despues" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "CHK_procesado_cabe"
    `);
    await queryRunner.query(`
      ALTER TABLE "services" ADD CONSTRAINT "CHK_procesado_cabe"
      CHECK ("procesado_desde" IS NULL OR "procesado_desde" + "procesado_minutos" <= "duration")
    `);

    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "CHK_procesado_pareja"
    `);
    await queryRunner.query(`
      ALTER TABLE "services" ADD CONSTRAINT "CHK_procesado_pareja"
      CHECK (("procesado_desde" IS NULL) = ("procesado_minutos" IS NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "CHK_procesado_pareja"
    `);
    await queryRunner.query(`
      ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "CHK_procesado_cabe"
    `);
    await queryRunner.query(`
      ALTER TABLE "services"
        DROP COLUMN IF EXISTS "buffer_despues",
        DROP COLUMN IF EXISTS "procesado_minutos",
        DROP COLUMN IF EXISTS "procesado_desde"
    `);
  }
}
