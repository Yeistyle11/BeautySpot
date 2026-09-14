"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useApi } from "./swr";
import { useAuthStore } from "./store";

/** El usuario tal como lo devuelve `GET /auth/me`. */
const usuarioSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullish(),
  avatar: z.string().nullish(),
});

/**
 * Rehidrata la sesion y pone en el store al usuario que la tiene. Sus datos no
 * se guardan en el navegador: son personales, la cookie de sesion no los
 * necesita, y en el mostrador compartido de una recepcion sobrevivirian a quien
 * los dejo. Se piden a auth cuando hay sesion y no estan en memoria.
 */
export function useSesion() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const { data } = useApi(
    hydrated && role && !user ? "/auth/me" : null,
    undefined,
    usuarioSchema
  );

  useEffect(() => {
    if (data) setAuth(data);
  }, [data, setAuth]);

  return { hydrated, role, user };
}
