import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices por usuario para las notificaciones.
 *
 * Se leen siempre por usuario —el listado y el contador de no leídas—, pero el
 * único índice que había era el de business_id, heredado de la entidad base,
 * que en esa consulta no acota nada.
 */
export class NotificationUserIndexes1700000000002 implements MigrationInterface {
  name = "NotificationUserIndexes1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_usuario_fecha"
      ON "notifications" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_usuario_leida"
      ON "notifications" ("user_id", "read")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notifications_usuario_leida"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notifications_usuario_fecha"`
    );
  }
}
