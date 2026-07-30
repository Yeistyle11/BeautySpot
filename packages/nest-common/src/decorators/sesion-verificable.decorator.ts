import { SetMetadata } from "@nestjs/common";

export const SESION_VERIFICABLE_KEY = "sesionVerificable";

/**
 * Marca una ruta que solo se atiende si se puede comprobar que la sesión sigue
 * vigente: si la comprobación de revocación no está disponible, se rechaza.
 */
export const SesionVerificable = () =>
  SetMetadata(SESION_VERIFICABLE_KEY, true);
