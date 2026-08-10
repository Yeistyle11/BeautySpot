import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";
import { BRANCH_ID_HEADER, REQUEST_ID_HEADER } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { ServiceUrlsConfig } from "../../config/service-urls";
import { ACCESS_COOKIE, leerCookie } from "../session/session-cookies";

/**
 * Resuelve a qué microservicio va cada petición y prepara su reenvío: la URL
 * destino, las cabeceras que se propagan y la traducción de la respuesta.
 */
@Injectable()
export class ProxyService {
  constructor(private serviceUrls: ServiceUrlsConfig) {}

  /** Devuelve la URL base del microservicio indicado. */
  getServiceUrl(serviceName: string): string {
    const normalized = this.normalize(serviceName);
    return this.serviceUrls.getUrl(normalized);
  }

  /** Indica si el nombre corresponde a un servicio conocido; se usa para rechazar rutas desconocidas. */
  isValidService(serviceName: string): boolean {
    const normalized = this.normalize(serviceName);
    return this.serviceUrls.hasUrl(normalized);
  }

  /**
   * Reescribe la ruta del gateway quitándole el prefijo `/api/v1/:service` y
   * conservando la cadena de consulta.
   */
  buildTargetUrl(service: string, req: Request): string {
    const serviceUrl = this.getServiceUrl(service);
    let path = req.path;

    if (path.startsWith("/api/v1/")) {
      path = path.replace(`/api/v1/${service}`, "");
    } else if (path.startsWith("/v1/")) {
      path = path.replace(`/v1/${service}`, "");
    }

    const interrogante = req.originalUrl.indexOf("?");
    const consulta =
      interrogante === -1 ? "" : req.originalUrl.slice(interrogante);

    return `${serviceUrl}${path}${consulta}`;
  }

  /**
   * Propaga el token de autorización, el identificador de la petición y el
   * tenant (x-business-id) al backend.
   */
  buildForwardedHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    // El navegador manda la cookie httpOnly; los servicios leen Authorization.
    const autorizacion =
      (req.headers["authorization"] as string | undefined) ??
      this.bearerDeCookie(req);
    if (autorizacion) {
      headers["authorization"] = autorizacion;
    }

    // Sin esto cada servicio inventaría el suyo y la petición dejaría de ser
    // seguible más allá del gateway.
    const requestId = req.headers[REQUEST_ID_HEADER];
    if (typeof requestId === "string") {
      headers[REQUEST_ID_HEADER] = requestId;
    }

    const negocio = this.negocioDeLaPeticion(req);
    if (negocio) {
      headers["x-business-id"] = negocio;
    }

    // Sede activa, que acota dentro del negocio.
    const sede = req.headers[BRANCH_ID_HEADER];
    if (typeof sede === "string" && sede.length > 0) {
      headers[BRANCH_ID_HEADER] = sede;
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      headers["content-type"] = "application/json";
    }

    return headers;
  }

  /**
   * Negocio sobre el que va la petición: el que pide el cliente si tiene
   * membresía en él, y si no el suyo por defecto.
   *
   * Quien trabaja en dos sitios necesita poder decir en cuál está operando; sin
   * atender esa cabecera, solo podría entrar al primero de su lista.
   */
  private negocioDeLaPeticion(req: Request): string | undefined {
    const user = (
      req as Request & {
        user?: { role?: string; businessId?: string; businessIds?: string[] };
      }
    ).user;
    if (!user) return undefined;

    const pedido = req.headers["x-business-id"];
    const porDefecto = user.businessId ?? user.businessIds?.[0];
    if (typeof pedido !== "string" || !pedido) return porDefecto;

    if (user.role === Role.SUPER_ADMIN) return pedido;

    const suyos =
      user.businessIds ?? (user.businessId ? [user.businessId] : []);
    if (!suyos.includes(pedido)) {
      throw new ForbiddenException("No tienes acceso a este negocio");
    }

    return pedido;
  }

  /** Parsea el cuerpo de la respuesta tolerando 204, cuerpo vacío o texto no-JSON. */
  async parseResponseBody(response: globalThis.Response): Promise<unknown> {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  /** Traduce fallos de red o timeouts del fetch en errores HTTP de gateway (502/504/503). */
  mapProxyError(service: string, error: unknown): HttpException {
    if (error instanceof HttpException) return error;

    if (error instanceof Error && error.name === "AbortError") {
      return new HttpException(
        `Servicio ${service} excedió el tiempo límite`,
        HttpStatus.GATEWAY_TIMEOUT
      );
    }

    return new HttpException(
      `Servicio ${service} no disponible`,
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  /** Convierte la cookie de sesión en una cabecera Bearer para los servicios. */
  private bearerDeCookie(req: Request): string | undefined {
    const token = leerCookie(req, ACCESS_COOKIE);
    return token ? `Bearer ${token}` : undefined;
  }

  /** Quita el sufijo "-service" para que "auth-service" y "auth" resuelvan igual. */
  private normalize(serviceName: string): string {
    return serviceName.replace("-service", "");
  }
}
