import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices para localizar los clientes de un usuario, con y sin negocio, que es
 * como consulta /internal/clients/by-user.
 */
export class ClientUserIndexes1700000000002 implements MigrationInterface {
  name = "ClientUserIndexes1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_usuario"
      ON "clients" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_clients_negocio_usuario"
      ON "clients" ("business_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_clients_negocio_usuario"`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_clients_usuario"`);
  }
}
