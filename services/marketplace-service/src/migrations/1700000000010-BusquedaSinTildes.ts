import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índices que sirven la búsqueda pública del marketplace: la consulta compara
 * `translate(lower(columna), …) LIKE '%texto%'`, que solo sirve un GIN de
 * trigramas sobre esa misma expresión, la de `columnaSinTildes`.
 */
export class BusquedaSinTildes1700000000010 implements MigrationInterface {
  name = "BusquedaSinTildes1700000000010";

  /** Columnas por las que se busca texto, con el índice que les toca. */
  private readonly indices: Array<[string, string, string]> = [
    ["idx_business_profiles_nombre_texto", "business_profiles", "name"],
    [
      "idx_business_profiles_descripcion_texto",
      "business_profiles",
      "description",
    ],
    ["idx_business_profiles_ciudad_texto", "business_profiles", "city"],
    ["idx_business_profiles_lema_texto", "business_profiles", "tagline"],
    ["idx_professional_profiles_nombre_texto", "professional_profiles", "name"],
    ["idx_professional_profiles_bio_texto", "professional_profiles", "bio"],
    [
      "idx_professional_profiles_especialidades_texto",
      "professional_profiles",
      "specialties",
    ],
  ];

  /** La misma normalización que aplica la consulta a la columna. */
  private sinTildes(columna: string): string {
    return `translate(lower("${columna}"), 'áàäâãéèëêíìïîóòöôõúùüûýÿÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÝ', 'aaaaaeeeeiiiiooooouuuuyyAAAAAEEEEIIIIOOOOOUUUUY')`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    for (const [indice, tabla, columna] of this.indices) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "${indice}"
        ON "${tabla}" USING GIN (${this.sinTildes(columna)} gin_trgm_ops)
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
