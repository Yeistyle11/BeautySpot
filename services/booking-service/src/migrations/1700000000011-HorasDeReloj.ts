import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pasa a hora de reloj lo que se guardaba contado desde la medianoche del dia
 * que empezo: las "25:00" son la 01:00 y las "24:30", las 00:30.
 */
export class HorasDeReloj1700000000011 implements MigrationInterface {
  name = "HorasDeReloj1700000000011";

  /** Resta 24 horas a las horas que se pasaban del día. */
  private readonly aReloj = (tabla: string, columna: string) => `
    UPDATE "${tabla}"
    SET "${columna}" = lpad(
          (split_part("${columna}", ':', 1)::int - 24)::text, 2, '0'
        ) || ':' || split_part("${columna}", ':', 2)
    WHERE "${columna}" IS NOT NULL
      AND split_part("${columna}", ':', 1)::int >= 24
      AND "${columna}" <> '24:00'
  `;

  /** Se las devuelve a las que quedaron antes de su hora de entrada. */
  private readonly aJornada = (
    tabla: string,
    columna: string,
    inicio: string
  ) => `
    UPDATE "${tabla}"
    SET "${columna}" = lpad(
          (split_part("${columna}", ':', 1)::int + 24)::text, 2, '0'
        ) || ':' || split_part("${columna}", ':', 2)
    WHERE "${columna}" IS NOT NULL
      AND "${columna}" <= "${inicio}"
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(this.aReloj("availabilities", "end_time"));
    await queryRunner.query(this.aReloj("appointments", "end_time"));
    await queryRunner.query(this.aReloj("appointments", "ocupado_hasta"));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      this.aJornada("availabilities", "end_time", "start_time")
    );
    await queryRunner.query(
      this.aJornada("appointments", "end_time", "start_time")
    );
    await queryRunner.query(
      this.aJornada("appointments", "ocupado_hasta", "start_time")
    );
  }
}
