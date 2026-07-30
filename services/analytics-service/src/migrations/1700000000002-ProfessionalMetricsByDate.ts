import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índice por negocio y fecha para las métricas de profesionales, que es como
 * las filtran los reportes y el ranking del panel.
 */
export class ProfessionalMetricsByDate1700000000002 implements MigrationInterface {
  name = "ProfessionalMetricsByDate1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_professional_metrics_negocio_fecha"
      ON "professional_metrics" ("business_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_professional_metrics_negocio_fecha"`
    );
  }
}
