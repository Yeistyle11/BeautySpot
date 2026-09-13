"use client";

// Apertura del formulario de alta de un modulo desde un enlace de otro.
import { useEffect, useRef } from "react";

/** Parametro con el que un enlace pide abrir el alta al llegar al modulo. */
export const PARAM_DE_ALTA = "nuevo";

/** Ruta del modulo con el parametro que abre su formulario de alta. */
export function rutaDeAlta(modulo: string): string {
  return `${modulo}?${PARAM_DE_ALTA}=1`;
}

/** Abre el formulario de alta al llegar con `?nuevo=1`, y quita el parametro. */
export function useAltaPorUrl(abrir: () => void): void {
  // En una ref: el efecto solo corre al montar.
  const abrirRef = useRef(abrir);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(PARAM_DE_ALTA) !== "1") return;
    url.searchParams.delete(PARAM_DE_ALTA);
    window.history.replaceState(null, "", url);
    abrirRef.current();
  }, []);
}
