"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Ancho a partir del cual Tailwind considera la pantalla `lg`. */
const ESCRITORIO = "(min-width: 1024px)";

/**
 * Indica si la pantalla es de escritorio (`lg` o mayor). El sidebar lo necesita
 * en JavaScript y no solo en CSS: en movil es un panel modal, y `inert`, el foco
 * y `aria-modal` no se pueden expresar con una media query.
 */
export function useEsEscritorio(): boolean {
  const suscribirse = useCallback((avisar: () => void) => {
    const consulta = window.matchMedia(ESCRITORIO);
    consulta.addEventListener("change", avisar);
    return () => consulta.removeEventListener("change", avisar);
  }, []);

  return useSyncExternalStore(
    suscribirse,
    () => window.matchMedia(ESCRITORIO).matches,
    // En el servidor no hay ancho que medir. Se asume escritorio para que el
    // marcado inicial deje el menu navegable: en movil el primer efecto lo
    // corrige antes de que nadie pueda tabular.
    () => true
  );
}
