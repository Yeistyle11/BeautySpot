import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pasa la hora de cierre a la que marca el reloj: el negocio que cerraba a las
 * "26:00" cierra a las 02:00.
 */
export class HoraDeCierreDeReloj1700000000012 implements MigrationInterface {
  name = "HoraDeCierreDeReloj1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "business_hours"
      SET "close_time" = lpad(
            (split_part("close_time", ':', 1)::int - 24)::text, 2, '0'
          ) || ':' || split_part("close_time", ':', 2)
      WHERE split_part("close_time", ':', 1)::int >= 24
        AND "close_time" <> '24:00'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "business_hours"
      SET "close_time" = lpad(
            (split_part("close_time", ':', 1)::int + 24)::text, 2, '0'
          ) || ':' || split_part("close_time", ':', 2)
      WHERE "close_time" <= "open_time"
    `);
  }
}
