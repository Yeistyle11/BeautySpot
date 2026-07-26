import type { CookieOptions, Request, Response } from "express";

/** Cookie con el access token. La lee el gateway en cada petición. */
export const ACCESS_COOKIE = "bs_access";

/** Cookie con el refresh token, restringida a la ruta que lo canjea. */
export const REFRESH_COOKIE = "bs_refresh";

/**
 * Cookie legible por JavaScript con datos NO sensibles de la sesión (rol,
 * negocio, caducidad). No es una credencial: sirve para que el frontend pinte
 * la interfaz sin esperar a una llamada. La autorización real la deciden
 * siempre los guards del backend con el token de la cookie httpOnly.
 */
export const SESSION_HINT_COOKIE = "bs_session";

const SEGUNDOS_POR_DIA = 24 * 60 * 60;

/**
 * Opciones comunes de las cookies de sesión.
 *
 * `sameSite: "lax"` es la defensa CSRF principal: el navegador no adjunta la
 * cookie en peticiones POST originadas en otro sitio. El tenant va por
 * subdominio (`{slug}.beautyspot.co`), que comparte sitio registrable con el
 * dominio de la API, así que las peticiones legítimas no se ven afectadas.
 *
 * `secure` se activa fuera de desarrollo porque en http://localhost el
 * navegador descarta las cookies marcadas como seguras.
 */
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

/** Vida de cada cookie, en segundos, leída de la configuración del JWT. */
export interface VidaSesion {
  accessSegundos: number;
  refreshSegundos: number;
}

/**
 * Escribe las cookies de sesión en la respuesta.
 *
 * El access token va en `path: "/"` porque lo necesita cualquier petición; el
 * refresh se restringe a la ruta de renovación, de modo que no viaja en cada
 * llamada y su exposición se limita a un único endpoint.
 */
export function fijarCookiesDeSesion(
  res: Response,
  tokens: { accessToken: string; refreshToken?: string },
  vida: VidaSesion,
  configService: { get<T>(clave: string): T | undefined },
  pista?: object
): void {
  const base = opcionesBase(configService);

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: "/",
    maxAge: vida.accessSegundos * 1000,
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

/**
 * Lee una cookie de la petición.
 *
 * Se parsea a mano en lugar de añadir cookie-parser: son dos cookies y el
 * formato de la cabecera es trivial, así que no compensa una dependencia más en
 * el servicio que está expuesto a internet.
 */
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
