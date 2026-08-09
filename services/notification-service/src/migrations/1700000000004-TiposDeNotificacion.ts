import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Añade los tipos de notificación de cita creada y pago registrado.
 *
 * Son los dos momentos en los que el negocio y el cliente esperaban un aviso y
 * no lo recibían: la reserva y el cobro.
 */
export class TiposDeNotificacion1700000000004 implements MigrationInterface {
  name = "TiposDeNotificacion1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS porque en los entornos donde el esquema lo genera
    // `synchronize` los valores ya están puestos.
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CREATED'`
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'PAYMENT_REGISTERED'`
    );
  }

  public async down(): Promise<void> {
    // Postgres no sabe quitar un valor de un enum, y borrar y recrear el tipo
    // obligaría a reescribir la tabla entera: dejar los valores de más es
    // inocuo, así que la reversión no hace nada.
  }
}
