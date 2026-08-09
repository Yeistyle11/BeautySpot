import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Guarda en el cierre de caja el saldo esperado y su diferencia con el contado.
 *
 * Las sesiones ya cerradas se quedan sin ambos valores: sus movimientos siguen
 * ahí, pero el recuento que hizo quien cerró no se registró y no se puede
 * reconstruir.
 */
export class DescuadreDeCaja1700000000007 implements MigrationInterface {
  name = "DescuadreDeCaja1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_sessions"
      ADD COLUMN "expected_total" numeric(10,2),
      ADD COLUMN "difference" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_sessions"
      DROP COLUMN "expected_total",
      DROP COLUMN "difference"
    `);
  }
}
