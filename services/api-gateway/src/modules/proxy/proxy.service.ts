import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Request } from "express";
import { REQUEST_ID_HEADER } from "@beautyspot/nest-common";
import { ServiceUrlsConfig } from "../../config/service-urls";
import { ACCESS_COOKIE, leerCookie } from "../session/session-cookies";

/**
 * Resuelve a qué microservicio va cada petición y prepara su reenvío: la URL
 * destino, las cabeceras que se propagan y la traducción de la respuesta.
 *
 * Toda esta mecánica vivía en el controlador, que acabó siendo el único con
 * lógica de infraestructura del gateway mientras este servicio se limitaba a
 * resolver URLs.
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

    const user = (
      req as Request & {
        user?: { businessId?: string; businessIds?: string[] };
      }
    ).user;
    if (user?.businessId) {
      headers["x-business-id"] = user.businessId;
    } else if (user?.businessIds?.length) {
      headers["x-business-id"] = user.businessIds[0];
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      headers["content-type"] = "application/json";
    }

    return headers;
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
