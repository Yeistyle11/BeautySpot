import {
  Controller,
  All,
  Req,
  Res,
  Param,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ProxyService } from "./proxy.service";
import { CircuitBreakerService } from "../circuit-breaker/circuit-breaker.service";
import { PROXY_TIMEOUT_MS } from "@beautyspot/shared-constants";

const SERVER_ERROR_THRESHOLD = 500;

/**
 * Reenvía cualquier petición /api/v1/:service/* al microservicio correspondiente,
 * protegida por el circuit breaker para no insistir contra un backend caído.
 */
@Controller("api/v1")
export class ProxyController {
  constructor(
    private proxyService: ProxyService,
    private circuitBreaker: CircuitBreakerService
  ) {}

  // Express 5 (path-to-regexp v8) exige nombrar el comodín: "*" suelto ya no es
  // válido. "*splat" captura el resto de la ruta; no se consume por nombre
  // porque buildTargetUrl reconstruye el path desde req.path.
  /** Valida que el servicio exista y ejecuta el reenvío bajo el circuit breaker. */
  @All(":service/*splat")
  async proxyRequest(
    @Param("service") service: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!this.proxyService.isValidService(service)) {
      throw new HttpException(
        `Servicio "${service}" no encontrado`,
        HttpStatus.NOT_FOUND
      );
    }

    return this.circuitBreaker.execute(service, () =>
      this.proxiedRequest(service, req, res)
    );
  }

  /** Ejecuta el fetch reenviado con timeout y propaga la respuesta del backend. */
  private async proxiedRequest(
    service: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const targetUrl = this.buildTargetUrl(service, req);
    const headers = this.buildForwardedHeaders(req);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await this.parseResponseBody(response);
      res.status(response.status).json(data);

      if (response.status >= SERVER_ERROR_THRESHOLD) {
        throw new HttpException(
          `Servicio ${service} respondió ${response.status}`,
          HttpStatus.BAD_GATEWAY
        );
      }
    } catch (error) {
      clearTimeout(timeout);
      throw this.mapProxyError(service, error);
    }
  }

  /** Reescribe la ruta del gateway a la ruta interna esperada por el servicio destino. */
  private buildTargetUrl(service: string, req: Request): string {
    const serviceUrl = this.proxyService.getServiceUrl(service);
    let path = req.path;

    if (path.startsWith("/api/v1/")) {
      path = path.replace(`/api/v1/${service}`, "");
    } else if (path.startsWith("/v1/")) {
      path = path.replace(`/v1/${service}`, "");
    }

    if (service.endsWith("-service")) {
      const moduleName = service.replace("-service", "");
      path = `/${moduleName}${path}`;
    }

    return `${serviceUrl}${path}`;
  }

  /** Propaga el token de autorización e inyecta el tenant (x-business-id) al backend. */
  private buildForwardedHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"] as string;
    }

    const user = (req as any).user;
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
  private async parseResponseBody(
    response: globalThis.Response
  ): Promise<unknown> {
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
  private mapProxyError(service: string, error: unknown): HttpException {
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
}
