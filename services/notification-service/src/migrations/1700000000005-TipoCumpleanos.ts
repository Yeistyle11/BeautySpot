import { MigrationInterface, QueryRunner } from "typeorm";

/** Tipo de notificación de la felicitación de cumpleaños. */
export class TipoCumpleanos1700000000005 implements MigrationInterface {
  name = "TipoCumpleanos1700000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS porque en los entornos donde el esquema lo genera
    // `synchronize` el valor ya está puesto.
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'BIRTHDAY'`
    );
  }

  public async down(): Promise<void> {
    // Postgres no sabe quitar un valor de un enum, y borrar y recrear el tipo
    // obligaría a reescribir la tabla entera: dejar el valor de más es inocuo,
    // así que la reversión no hace nada.
  }
}
