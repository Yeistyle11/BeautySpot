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

/** Cuerpo que devuelve auth-service en login y renovación. */
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

// El registro no abre sesión: no emite tokens que convertir en cookies.
const RUTAS_LOGIN = ["/auth/login"];
const RUTA_REFRESH = "/auth/refresh";
const RUTA_LOGOUT = "/auth/logout";

/** Convierte los tokens que emite auth-service en cookies de sesión. */
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

  /** Cuerpo a reenviar; en la renovación inyecta el refresh token de la cookie. */
  cuerpoReenviado(req: Request, cuerpoOriginal: unknown): unknown {
    if (this.normalizar(req.path) !== RUTA_REFRESH) return cuerpoOriginal;

    const refreshToken = leerCookie(req, REFRESH_COOKIE);
    return { ...(cuerpoOriginal as object), refreshToken };
  }

  /** Fija o borra las cookies y devuelve el cuerpo sin tokens. */
  aplicarRespuesta(req: Request, res: Response, cuerpo: unknown): unknown {
    const ruta = this.normalizar(req.path);

    if (ruta === RUTA_LOGOUT) {
      limpiarCookiesDeSesion(res, this.configService);
      return cuerpo;
    }

    const datos = this.extraerDatos(cuerpo);

    // Una renovacion sin tokens es una sesion que ya no se puede renovar: se
    // borran sus cookies, pista incluida.
    if (!datos?.accessToken) {
      if (ruta === RUTA_REFRESH)
        limpiarCookiesDeSesion(res, this.configService);
      return cuerpo;
    }

    const pista = this.pistaDe(datos.accessToken);

    /** Escribe en cookies los tokens de la respuesta de autenticación. */
    fijarCookiesDeSesion(
      res,
      { accessToken: datos.accessToken, refreshToken: datos.refreshToken },
      this.vidaSesion(),
      this.configService,
      pista
    );

    // La pista va también en el cuerpo: el token es opaco para el frontend, y
    // pedir el rol y el negocio en otra llamada añadiría un viaje más al login.
    return this.sinTokens(cuerpo, pista);
  }

  /** Vida de las cookies, tomada de la configuración del JWT de auth-service. */
  private vidaSesion() {
    return {
      refreshSegundos: aSegundos(
        this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "",
        7 * 24 * 60 * 60
      ),
    };
  }

  /** Extrae del token los datos no sensibles de sesión, sin verificar la firma. */
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

  /** Lee el contenido de un JWT sin verificarlo, solo para consultarlo. */
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

  /** Quita del cuerpo los tokens, que ya viajan en cookies. */
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
