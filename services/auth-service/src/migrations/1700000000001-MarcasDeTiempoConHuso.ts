import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pasa todas las marcas de tiempo del esquema de `timestamp without time zone`
 * a `timestamptz`.
 *
 * Una columna sin huso guarda la hora de pared de quien la escribe: Postgres,
 * que corre en UTC, en los valores por defecto (`created_at`, `updated_at`), y
 * el proceso Node en su hora local en las que fija la aplicación. Al leerlas, el
 * driver las reinterpreta en la zona del proceso, así que las primeras salían
 * desplazadas y las segundas no, y el mismo instante se pintaba con horas de
 * diferencia según la pantalla.
 *
 * Los valores existentes se reinterpretan como UTC, que es la zona en la que
 * están escritos los `created_at`/`updated_at` que motivaron el cambio. Lo que
 * la aplicación hubiera escrito desde un proceso en otra zona queda desplazado
 * esa diferencia: es dato de desarrollo y no compensa arrastrar una conversión
 * columna a columna para conservarlo.
 */
export class MarcasDeTiempoConHuso1700000000001 implements MigrationInterface {
  name = "MarcasDeTiempoConHuso1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE columna RECORD;
      BEGIN
        FOR columna IN
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type = 'timestamp without time zone'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE $tz$UTC$tz$',
            columna.table_name, columna.column_name, columna.column_name
          );
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE columna RECORD;
      BEGIN
        FOR columna IN
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type = 'timestamp with time zone'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE $tz$UTC$tz$',
            columna.table_name, columna.column_name, columna.column_name
          );
        END LOOP;
      END $$;
    `);
  }
}
