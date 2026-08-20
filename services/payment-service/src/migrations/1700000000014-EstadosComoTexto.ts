import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pasa a `varchar` las cuatro columnas que eran enum nativo de Postgres: método
 * y estado del cobro, estado de la factura y tipo de movimiento de caja.
 */
export class EstadosComoTexto1700000000014 implements MigrationInterface {
  name = "EstadosComoTexto1700000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // El índice de cobro vivo filtra por `status`: cae y se rehace sobre la
    // columna ya convertida.
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_payments_cita_viva"`);

    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "method" TYPE character varying USING "method"::text
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "status" TYPE character varying USING "status"::text
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'COMPLETED'
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ALTER COLUMN "status" TYPE character varying USING "status"::text
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'DRAFT'
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_movements"
        ALTER COLUMN "type" TYPE character varying USING "type"::text
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_cita_viva"
        ON "payments" ("business_id", "appointment_id")
        WHERE "appointment_id" IS NOT NULL
          AND status IN ('PENDING', 'COMPLETED')
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "payments_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "invoices_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cash_movements_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payments_method_enum" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER')
    `);
    await queryRunner.query(`
      CREATE TYPE "payments_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TYPE "invoices_status_enum" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TYPE "cash_movements_type_enum" AS ENUM ('IN', 'OUT')
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_payments_cita_viva"`);

    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "method" TYPE "payments_method_enum"
        USING "method"::"payments_method_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "status" TYPE "payments_status_enum"
        USING "status"::"payments_status_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'COMPLETED'
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ALTER COLUMN "status" TYPE "invoices_status_enum"
        USING "status"::"invoices_status_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'DRAFT'
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_movements"
        ALTER COLUMN "type" TYPE "cash_movements_type_enum"
        USING "type"::"cash_movements_type_enum"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_cita_viva"
        ON "payments" ("business_id", "appointment_id")
        WHERE "appointment_id" IS NOT NULL
          AND status IN ('PENDING', 'COMPLETED')
    `);
  }
}
