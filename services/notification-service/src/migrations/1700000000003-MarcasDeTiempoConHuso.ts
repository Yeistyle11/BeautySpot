import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pasa las marcas de tiempo del esquema a `timestamptz`: sin huso, la columna
 * guarda la hora de pared de quien escribe y el mismo instante se lee distinto.
 * Los valores existentes se reinterpretan como UTC.
 */
export class MarcasDeTiempoConHuso1700000000003 implements MigrationInterface {
  name = "MarcasDeTiempoConHuso1700000000003";

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
