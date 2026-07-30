import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices para localizar los clientes de un usuario.
 *
 * El endpoint interno /internal/clients/by-user consulta por user_id sin acotar
 * por negocio, sobre una tabla que contiene los clientes de todos los negocios:
 * sin índice era un recorrido secuencial. Está además en el camino síncrono del
 * listado "mis citas", que booking pide antes de poder consultar sus propias
 * citas, así que su coste se paga en cada carga de esa pantalla.
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
