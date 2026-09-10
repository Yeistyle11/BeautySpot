import { DataSource, EntityTarget, ObjectLiteral } from "typeorm";

/** Filas por sentencia; Postgres tiene un tope de parámetros por consulta. */
const LOTE = 400;

/**
 * Escribe las filas por su clave primaria, actualizando las que ya estuvieran.
 * Es lo que hace la siembra repetible: los identificadores se derivan del nombre
 * de la cosa (ver `idDe`), así que la segunda pasada cae sobre las mismas filas.
 */
export async function guardar<T extends ObjectLiteral>(
  dataSource: DataSource,
  entidad: EntityTarget<T>,
  filas: T[]
): Promise<number> {
  const repo = dataSource.getRepository(entidad);
  for (let i = 0; i < filas.length; i += LOTE) {
    await repo.upsert(filas.slice(i, i + LOTE) as never, ["id"]);
  }
  return filas.length;
}

/**
 * Borra las filas de los negocios indicados. Nunca vacía una tabla entera: en
 * la base de desarrollo puede haber datos escritos a mano que no son de la
 * siembra y que no le corresponde tirar.
 */
export async function borrarPorNegocio(
  dataSource: DataSource,
  tabla: string,
  negocios: string[]
): Promise<void> {
  await dataSource.query(
    `DELETE FROM "${tabla}" WHERE "business_id" = ANY($1)`,
    [negocios]
  );
}

/** Borra las filas hijas cuya columna apunte a una fila ya borrada del padre. */
export async function borrarHuerfanas(
  dataSource: DataSource,
  tabla: string,
  columna: string,
  tablaPadre: string
): Promise<void> {
  await dataSource.query(
    `DELETE FROM "${tabla}" h
      WHERE NOT EXISTS (
        SELECT 1 FROM "${tablaPadre}" p WHERE p."id" = h."${columna}"
      )`
  );
}
