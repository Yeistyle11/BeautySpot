"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./tema-inicial";

export type Theme = "light" | "dark";

export { THEME_STORAGE_KEY } from "./tema-inicial";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Tema elegido por el usuario, o claro si aún no ha elegido. */
export function temaGuardado(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

// El tema no vive en React: lo guarda localStorage y lo aplica el script que
// corre en <head> antes del primer pintado. Estos oyentes son lo que permite
// leerlo con useSyncExternalStore, que ya sabe distinguir el valor del servidor
// del del navegador y no necesita un efecto que lo copie despues de montar.
const oyentes = new Set<() => void>();

function avisarDelCambio() {
  oyentes.forEach((oyente) => oyente());
}

function suscribirseAlTema(oyente: () => void): () => void {
  oyentes.add(oyente);
  // Otra pestaña del mismo usuario tambien puede cambiarlo.
  window.addEventListener("storage", oyente);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
}

/** En el servidor no hay eleccion que leer: se pinta el tema claro. */
function temaEnElServidor(): Theme {
  return "light";
}

/**
 * Tema claro/oscuro: pone o quita la clase `dark` en <html>. Arranca en claro y
 * sólo pasa a oscuro si el usuario lo pide; su elección queda guardada.
 */
export function useTheme() {
  const theme = useSyncExternalStore(
    suscribirseAlTema,
    temaGuardado,
    temaEnElServidor
  );

  const toggleTheme = useCallback(() => {
    const next: Theme = temaGuardado() === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    avisarDelCambio();
  }, []);

  return { theme, toggleTheme };
}
