"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ui:v1:theme";

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Tema claro/oscuro. Tailwind esta configurado con `darkMode: ["class"]`, asi
 * que basta con poner o quitar la clase `dark` en <html>; los tokens de
 * globals.css hacen el resto.
 *
 * La eleccion del usuario se guarda; si no ha elegido nada, se respeta la
 * preferencia del sistema operativo.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = stored ?? (prefersDark() ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
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

  // `mounted` evita pintar el icono equivocado en el primer render del
  // servidor, que no sabe que tema tiene guardado el usuario.
  return { theme, toggleTheme, mounted };
}
