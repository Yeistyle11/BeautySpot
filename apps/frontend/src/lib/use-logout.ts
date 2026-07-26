"use client";

import { useCallback } from "react";
import { api } from "./api";
import { useAuthStore } from "./store";

/**
 * Cierra la sesión: pide al gateway que borre las cookies httpOnly y limpia el
 * estado local. No vive en el `logout()` del store porque a ese lo llama el
 * manejador del 401, y una petición ahí se realimentaría.
 */
export function useLogout() {
  const logout = useAuthStore((state) => state.logout);

  return useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // Sin sesión válida que cerrar, la salida local sigue adelante.
    }
    logout();
  }, [logout]);
}
