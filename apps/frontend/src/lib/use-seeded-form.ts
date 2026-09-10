"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Vuelca en un formulario el dato que llega del backend, una sola vez: se salta
 * mientras el dato es nulo y no se repite al revalidar, para no borrar lo
 * escrito. Devuelve una funcion para volver a admitir siembra.
 */
export function useSeededForm<T>(
  dato: T | null | undefined,
  sembrar: (dato: T) => void
): () => void {
  const sembrado = useRef(false);
  // La funcion suele ser un literal nuevo en cada render; guardarla en una ref
  // evita sembrar de nuevo solo porque cambie su identidad. Se actualiza en su
  // propio efecto, porque escribirla durante el render rompe el modo concurrente.
  const ultimaSiembra = useRef(sembrar);
  useEffect(() => {
    ultimaSiembra.current = sembrar;
  });

  useEffect(() => {
    if (dato == null || sembrado.current) return;
    sembrado.current = true;
    ultimaSiembra.current(dato);
  }, [dato]);

  return useCallback(() => {
    sembrado.current = false;
  }, []);
}
