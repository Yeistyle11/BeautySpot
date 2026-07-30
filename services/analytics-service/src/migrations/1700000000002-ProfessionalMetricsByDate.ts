import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índice por negocio y fecha para las métricas de profesionales.
 *
 * El único índice existente es el único (business_id, professional_id, date).
 * Los reportes y el ranking del panel filtran por negocio y rango de fechas
 * agrupando por profesional: con professional_id como segunda columna, Postgres
 * no puede acotar por fecha y recorre todas las filas del negocio desde siempre
 * para responder sobre un mes.
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
