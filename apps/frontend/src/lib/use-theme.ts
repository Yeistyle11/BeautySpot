"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ui:v1:theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Tema elegido por el usuario, o claro si aún no ha elegido. */
export function temaGuardado(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

/**
 * Aplica el tema guardado. Vive aparte del hook porque lo llama la raíz de la
 * aplicación, que es lo único por lo que pasan todas las páginas.
 */
export function aplicarTemaGuardado(): Theme {
  const tema = temaGuardado();
  applyTheme(tema);
  return tema;
}

/**
 * Tema claro/oscuro: pone o quita la clase `dark` en <html>. Arranca en claro y
 * sólo pasa a oscuro si el usuario lo pide; su elección queda guardada.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(aplicarTemaGuardado());
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  // `mounted` indica que ya se ha leído el tema guardado.
  return { theme, toggleTheme, mounted };
}
