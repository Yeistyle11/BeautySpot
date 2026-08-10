import { MigrationInterface, QueryRunner } from "typeorm";

/** Tablas de métricas por cliente, por servicio y de capacidad diaria. */
export class MetricasDeNegocio1700000000004 implements MigrationInterface {
  name = "MetricasDeNegocio1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "client_metrics" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "client_id" uuid NOT NULL, "primera_visita" date NOT NULL, "ultima_visita" date NOT NULL, "visitas" integer NOT NULL DEFAULT '0', "gasto" numeric(12,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_613fd4b8e19ea5f2a31167b8d07" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1fd6db4a954d51361c8e7a30b8" ON "client_metrics" ("business_id") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_e1afb51e180490083400123f40" ON "client_metrics" ("business_id", "client_id") `
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "service_metrics" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "service_id" uuid NOT NULL, "service_name" character varying NOT NULL, "date" date NOT NULL, "veces" integer NOT NULL DEFAULT '0', "ingresos" numeric(12,2) NOT NULL DEFAULT '0', "minutos" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_85dc0bb25e5bc0c341dbc75c06a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_e31e02aa6847a883d6dcb6db85" ON "service_metrics" ("business_id") `
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1a0aed432755fdc0444d26640d" ON "service_metrics" ("business_id", "date") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a6472f9c18343ac733a3c57d95" ON "service_metrics" ("business_id", "service_id", "date") `
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "capacity_daily" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "professional_id" uuid NOT NULL, "date" date NOT NULL, "minutos_disponibles" integer NOT NULL DEFAULT '0', "minutos_vendidos" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_05ad052912c3c101d31eeea44f1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_08545933a7d85d30766f2fcd2d" ON "capacity_daily" ("business_id") `
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_e55b2289ca49d55b1727c974e2" ON "capacity_daily" ("business_id", "date") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_9c5f0f587c06d2bb6be74050ce" ON "capacity_daily" ("business_id", "professional_id", "date") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_9c5f0f587c06d2bb6be74050ce"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_e55b2289ca49d55b1727c974e2"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_08545933a7d85d30766f2fcd2d"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "capacity_daily"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_a6472f9c18343ac733a3c57d95"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_1a0aed432755fdc0444d26640d"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_e31e02aa6847a883d6dcb6db85"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "service_metrics"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_e1afb51e180490083400123f40"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_1fd6db4a954d51361c8e7a30b8"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "client_metrics"`);
  }
}
