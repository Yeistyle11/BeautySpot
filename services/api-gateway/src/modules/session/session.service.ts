import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import {
  REFRESH_COOKIE,
  aSegundos,
  fijarCookiesDeSesion,
  leerCookie,
  limpiarCookiesDeSesion,
} from "./session-cookies";

/** Cuerpo que devuelve auth-service en login, registro y renovación. */
interface RespuestaConTokens {
  accessToken?: string;
  refreshToken?: string;
  [clave: string]: unknown;
}

/** Campos del JWT que el frontend necesita para pintar la interfaz. */
interface PistaSesion {
  role?: string;
  businessId?: string;
  businessIds?: string[];
  expiresAt?: number;
}

const RUTAS_LOGIN = ["/auth/login", "/auth/register"];
const RUTA_REFRESH = "/auth/refresh";
const RUTA_LOGOUT = "/auth/logout";

/**
 * Convierte los tokens que emite auth-service en cookies de sesión.
 *
 * Vive en el gateway porque es el único servicio que habla con navegadores:
 * auth-service sigue devolviendo tokens en el cuerpo y puede seguir sirviendo a
 * un cliente que no use cookies. La política de cookies queda en un solo sitio,
 * en el borde.
 */
@Injectable()
export class SessionService {
  constructor(private readonly configService: ConfigService) {}

  /** Indica si la ruta forma parte del flujo de sesión que hay que interceptar. */
  esRutaDeSesion(path: string): boolean {
    const normalizada = this.normalizar(path);
    return (
      RUTAS_LOGIN.includes(normalizada) ||
      normalizada === RUTA_REFRESH ||
      normalizada === RUTA_LOGOUT
    );
  }

  /**
   * Cuerpo que hay que reenviar a auth-service.
   *
   * En la renovación el refresh token ya no lo tiene el frontend —vive en una
   * cookie httpOnly—, así que el gateway lo saca de ahí y lo inyecta en el
   * cuerpo que auth-service espera.
   */
  cuerpoReenviado(req: Request, cuerpoOriginal: unknown): unknown {
    if (this.normalizar(req.path) !== RUTA_REFRESH) return cuerpoOriginal;

    const refreshToken = leerCookie(req, REFRESH_COOKIE);
    return { ...(cuerpoOriginal as object), refreshToken };
  }

  /**
   * Aplica el resultado de auth-service a la respuesta del navegador: fija o
   * borra las cookies y devuelve el cuerpo ya sin tokens.
   *
   * Quitar los tokens del cuerpo es la mitad del cambio: si siguieran ahí, el
   * JavaScript de la página podría leerlos igualmente y la cookie httpOnly no
   * habría servido de nada.
   */
  aplicarRespuesta(req: Request, res: Response, cuerpo: unknown): unknown {
    const ruta = this.normalizar(req.path);

    if (ruta === RUTA_LOGOUT) {
      limpiarCookiesDeSesion(res, this.configService);
      return cuerpo;
    }

    const datos = this.extraerDatos(cuerpo);
    if (!datos?.accessToken) return cuerpo;

    const pista = this.pistaDe(datos.accessToken);

    fijarCookiesDeSesion(
      res,
      { accessToken: datos.accessToken, refreshToken: datos.refreshToken },
      this.vidaSesion(),
      this.configService,
      pista
    );

    // La pista va también en el cuerpo: el frontend ya no puede descifrar el
    // token para saber con qué rol y negocio entra, y pedirlo en otra llamada
    // solo añadiría un viaje más al login.
    return this.sinTokens(cuerpo, pista);
  }

  /** Vida de cada cookie, tomada de la configuración del JWT de auth-service. */
  private vidaSesion() {
    return {
      accessSegundos: aSegundos(
        this.configService.get<string>("JWT_EXPIRES_IN") ?? "",
        15 * 60
      ),
      refreshSegundos: aSegundos(
        this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "",
        7 * 24 * 60 * 60
      ),
    };
  }

  /**
   * Datos no sensibles del token para que el frontend pinte la interfaz sin
   * tener que descifrar nada ni esperar a una llamada extra.
   *
   * Se lee el payload sin verificar la firma a propósito: aquí sólo alimenta la
   * interfaz, y el token acaba de llegar de auth-service por la red interna. La
   * decisión de autorización la toman los guards, que sí verifican.
   */
  private pistaDe(accessToken: string): PistaSesion | undefined {
    const payload = this.payloadDe(accessToken);
    if (!payload) return undefined;

    return {
      role: payload.role as string | undefined,
      businessId: payload.businessId as string | undefined,
      businessIds: payload.businessIds as string[] | undefined,
      expiresAt: payload.exp as number | undefined,
    };
  }

  private payloadDe(token: string): Record<string, unknown> | undefined {
    const partes = token.split(".");
    if (partes.length !== 3) return undefined;
    try {
      return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    } catch {
      return undefined;
    }
  }

  /** Los tokens pueden venir en la raíz del cuerpo o dentro del sobre `data`. */
  private extraerDatos(cuerpo: unknown): RespuestaConTokens | undefined {
    if (!cuerpo || typeof cuerpo !== "object") return undefined;
    const raiz = cuerpo as RespuestaConTokens & { data?: RespuestaConTokens };
    if (raiz.accessToken) return raiz;
    if (raiz.data?.accessToken) return raiz.data;
    return undefined;
  }

  private sinTokens(cuerpo: unknown, pista?: PistaSesion): unknown {
    if (!cuerpo || typeof cuerpo !== "object") return cuerpo;
    const raiz = cuerpo as Record<string, unknown> & {
      data?: Record<string, unknown>;
    };

    const limpiar = (objeto: Record<string, unknown>) => {
      const { accessToken: _a, refreshToken: _r, ...resto } = objeto;
      return pista ? { ...resto, session: pista } : resto;
    };

    if (raiz.data && typeof raiz.data === "object") {
      return { ...raiz, data: limpiar(raiz.data) };
    }
    return limpiar(raiz);
  }

  /** Quita el prefijo del gateway y el sufijo del servicio para comparar rutas. */
  private normalizar(path: string): string {
    return path
      .replace(/^\/api\/v1/, "")
      .replace(/^\/v1/, "")
      .replace(/^\/auth-service/, "/auth");
  }
}
