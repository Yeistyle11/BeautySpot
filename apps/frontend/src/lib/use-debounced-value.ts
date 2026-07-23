"use client";

import { useEffect, useState } from "react";

/**
 * Retrasa la propagacion de un valor hasta que deja de cambiar durante `delay`.
 * Se usa para las busquedas: sin esto cada tecla dispararia una peticion al
 * backend y las respuestas podrian llegar desordenadas.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
