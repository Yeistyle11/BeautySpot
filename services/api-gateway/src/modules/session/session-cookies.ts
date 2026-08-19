import type { CookieOptions, Request, Response } from "express";

/** Cookie con el access token. La lee el gateway en cada petición. */
export const ACCESS_COOKIE = "bs_access";

/** Cookie con el refresh token, restringida a la ruta que lo canjea. */
export const REFRESH_COOKIE = "bs_refresh";

/** Cookie legible con datos no sensibles de la sesión: rol, negocio y caducidad. */
export const SESSION_HINT_COOKIE = "bs_session";

const SEGUNDOS_POR_DIA = 24 * 60 * 60;

/** Opciones comunes de las cookies de sesión: httpOnly, SameSite=Lax y Secure en producción. */
function opcionesBase(configService: {
  get<T>(clave: string): T | undefined;
}): CookieOptions {
  const dominio = configService.get<string>("COOKIE_DOMAIN");
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(dominio ? { domain: dominio } : {}),
  };
}

/**
 * Vida de las cookies de sesion, en segundos: las tres duran lo que la sesion
 * de refresco.
 */
export interface VidaSesion {
  refreshSegundos: number;
}

/** Escribe las cookies de sesión; el refresh se acota a la ruta de renovación. */
export function fijarCookiesDeSesion(
  res: Response,
  tokens: { accessToken: string; refreshToken?: string },
  vida: VidaSesion,
  configService: { get<T>(clave: string): T | undefined },
  pista?: object
): void {
  const base = opcionesBase(configService);

  // La cookie vive lo que la sesion, no lo que el token que lleva dentro, que
  // caduca antes y es lo que el gateway valida en cada peticion.
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: "/",
    maxAge: vida.refreshSegundos * 1000,
  });

  if (tokens.refreshToken) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      path: "/api/v1/auth/refresh",
      maxAge: vida.refreshSegundos * 1000,
    });
  }

  if (pista) {
    res.cookie(SESSION_HINT_COOKIE, JSON.stringify(pista), {
      ...base,
      httpOnly: false,
      path: "/",
      maxAge: vida.refreshSegundos * 1000,
    });
  }
}

/** Borra las tres cookies de sesión. */
export function limpiarCookiesDeSesion(
  res: Response,
  configService: { get<T>(clave: string): T | undefined }
): void {
  const base = opcionesBase(configService);
  res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
  res.clearCookie(REFRESH_COOKIE, {
    ...base,
    path: "/api/v1/auth/refresh",
  });
  res.clearCookie(SESSION_HINT_COOKIE, {
    ...base,
    httpOnly: false,
    path: "/",
  });
}

/** Lee una cookie de la cabecera de la petición. */
export function leerCookie(req: Request, nombre: string): string | undefined {
  const cabecera = req.headers.cookie;
  if (!cabecera) return undefined;

  for (const parte of cabecera.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) continue;
    if (parte.slice(0, separador).trim() !== nombre) continue;
    return decodeURIComponent(parte.slice(separador + 1).trim());
  }
  return undefined;
}

/** Convierte "15m", "7d" o "3600" en segundos. */
export function aSegundos(duracion: string, porDefecto: number): number {
  const coincidencia = /^(\d+)([smhd])?$/.exec(duracion?.trim() ?? "");
  if (!coincidencia) return porDefecto;

  const valor = Number(coincidencia[1]);
  switch (coincidencia[2]) {
    case "m":
      return valor * 60;
    case "h":
      return valor * 3600;
    case "d":
      return valor * SEGUNDOS_POR_DIA;
    default:
      return valor;
  }
}
