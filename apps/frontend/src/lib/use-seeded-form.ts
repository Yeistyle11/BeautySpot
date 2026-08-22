"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Vuelca en un formulario el dato que llega del backend, una sola vez.
 *
 * La siembra se salta mientras el dato es nulo y no se repite cuando SWR
 * revalida: a partir del primer volcado manda lo que el usuario tenga escrito,
 * que si no se le borraria a mitad de edicion.
 *
 * Devuelve una funcion para volver a admitir siembra, util cuando el registro
 * se borra y el formulario pasa a estar disponible para uno nuevo.
 */
export function useSeededForm<T>(
  dato: T | null | undefined,
  sembrar: (dato: T) => void
): () => void {
  const sembrado = useRef(false);
  // La funcion suele ser un literal nuevo en cada render; guardarla en una ref
  // evita volver a sembrar solo porque haya cambiado su identidad.
  const ultimaSiembra = useRef(sembrar);
  ultimaSiembra.current = sembrar;

  useEffect(() => {
    if (dato == null || sembrado.current) return;
    sembrado.current = true;
    ultimaSiembra.current(dato);
  }, [dato]);

  return useCallback(() => {
    sembrado.current = false;
  }, []);
}
