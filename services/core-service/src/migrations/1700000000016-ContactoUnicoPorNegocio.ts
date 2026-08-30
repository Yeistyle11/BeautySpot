import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Una persona, una ficha: índices únicos parciales que sostienen en la base el
 * control de duplicados que hasta ahora solo hacía el servicio consultando
 * antes de insertar. Entre esa consulta y la escritura cabe otra transacción,
 * así que dos altas simultáneas con el mismo teléfono se colaban.
 *
 * Quedan fuera el nulo y la cadena vacía: la reserva pública crea la ficha del
 * invitado sin correo ni teléfono, y sin esa condición el segundo invitado sin
 * datos chocaría con el primero.
 *
 * Los teléfonos ya guardados no se reescriben —una ficha antigua puede seguir
 * sin indicativo—; de reconocerlas como la misma persona se encarga el cotejo
 * por variantes del servicio.
 */
export class ContactoUnicoPorNegocio1700000000016 implements MigrationInterface {
  name = "ContactoUnicoPorNegocio1700000000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_clients_email_por_negocio"
      ON "clients" ("business_id", "email")
      WHERE "email" IS NOT NULL AND "email" <> ''
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_clients_telefono_por_negocio"
      ON "clients" ("business_id", "phone")
      WHERE "phone" IS NOT NULL AND "phone" <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_clients_telefono_por_negocio"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_clients_email_por_negocio"`
    );
  }
}
