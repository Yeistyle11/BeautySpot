import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Una persona, una ficha: índices únicos parciales que sostienen en la base el
 * control de duplicados. Dejan fuera el nulo y la cadena vacía, que es lo que
 * guarda la reserva del invitado sin contacto.
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
