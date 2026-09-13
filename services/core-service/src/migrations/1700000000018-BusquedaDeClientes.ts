import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices que sirven la búsqueda de clientes del panel: la consulta compara
 * `translate(lower(columna), …) LIKE '%texto%'`, y a eso solo responde un GIN
 * de trigramas sobre esa misma expresión, la de `columnaSinTildes`. Sin ellos
 * cada búsqueda recorre la tabla entera evaluando el `translate` fila a fila,
 * y dos veces, porque el listado pide también el total.
 *
 * Son índices de expresión, que `@Index` no sabe declarar: en desarrollo, donde
 * el esquema sale de las entidades, no existen. Aquí no cambia el resultado,
 * solo el plan.
 */
export class BusquedaDeClientes1700000000018 implements MigrationInterface {
  name = "BusquedaDeClientes1700000000018";

  /** Columnas por las que busca el listado, con el índice que les toca. */
  private readonly indices: Array<[string, string]> = [
    ["idx_clients_nombre_texto", "name"],
    ["idx_clients_correo_texto", "email"],
    ["idx_clients_telefono_texto", "phone"],
  ];

  /** La misma normalización que aplica la consulta a la columna. */
  private sinTildes(columna: string): string {
    return `translate(lower("${columna}"), 'áàäâãéèëêíìïîóòöôõúùüûýÿÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÝ', 'aaaaaeeeeiiiiooooouuuuyyAAAAAEEEEIIIIOOOOOUUUUY')`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    for (const [indice, columna] of this.indices) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "${indice}"
        ON "clients" USING GIN (${this.sinTildes(columna)} gin_trgm_ops)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [indice] of this.indices) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${indice}"`);
    }
    // La extensión no se retira: puede haberla pedido otra migración.
  }
}
