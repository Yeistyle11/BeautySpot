import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices GIN de trigramas sobre la expresión sin tildes con la que la búsqueda
 * de clientes compara. Son de expresión: solo existen en producción.
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
