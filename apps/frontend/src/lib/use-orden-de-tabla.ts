"use client";

import { useCallback, useMemo, useState } from "react";

export type DireccionDeOrden = "asc" | "desc";

/**
 * Columna y sentido por los que ordena una tabla. Pulsar la columna actual da
 * la vuelta al sentido; pulsar otra empieza por el sentido inicial.
 */
export function useOrdenDeTabla<C extends string>(
  campoInicial: C,
  direccionInicial: DireccionDeOrden = "asc"
) {
  const [orden, setOrden] = useState<{
    campo: C;
    direccion: DireccionDeOrden;
  }>({ campo: campoInicial, direccion: direccionInicial });

  const alternarOrden = useCallback(
    (campo: C) =>
      setOrden((actual) =>
        actual.campo === campo
          ? {
              campo,
              direccion: actual.direccion === "asc" ? "desc" : "asc",
            }
          : { campo, direccion: direccionInicial }
      ),
    [direccionInicial]
  );

  /** El orden como lo espera el backend, listo para la query de la lista. */
  const params = useMemo(
    () => ({
      sort: orden.campo,
      order: orden.direccion === "asc" ? "ASC" : "DESC",
    }),
    [orden]
  );

  return { orden, alternarOrden, params };
}
