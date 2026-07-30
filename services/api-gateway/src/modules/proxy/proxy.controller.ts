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
import { SessionService } from "../session/session.service";

const SERVER_ERROR_THRESHOLD = 500;

/**
 * Detecta intentos de subir de directorio en la ruta reenviada.
 *
 * La ruta se reescribe quitándole el prefijo y se concatena con la URL del
 * servicio, sin normalizar. El analizador de URL que usa fetch interpreta
 * `%2e%2e` como un segmento `..`, de modo que una ruta como
 * `/api/v1/marketplace/x/%2e%2e/%2e%2e/internal/...` alcanzaría rutas internas
 * del backend. Se comprueba sobre la URL sin decodificar y también decodificada,
 * para que ninguna de las dos formas pase.
 */
function tieneSaltoDeDirectorio(url: string): boolean {
  const candidatas = [url];
  try {
    candidatas.push(decodeURIComponent(url));
  } catch {
    // Un porcentaje mal formado no se puede decodificar: se rechaza igual.
    return true;
  }
  return candidatas.some((v) => /(^|[/\\])\.\.($|[/\\])/.test(v));
}

/**
 * Reenvía cualquier petición /api/v1/:service/* al microservicio correspondiente,
 * protegida por el circuit breaker para no insistir contra un backend caído.
 */
@Controller("api/v1")
export class ProxyController {
  constructor(
    private proxyService: ProxyService,
    private circuitBreaker: CircuitBreakerService,
    private sessionService: SessionService
  ) {}

  // Express 5 exige nombrar el comodín: "*splat" captura el resto de la ruta.
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

    if (tieneSaltoDeDirectorio(req.originalUrl)) {
      throw new HttpException("Ruta no válida", HttpStatus.BAD_REQUEST);
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
    const targetUrl = this.proxyService.buildTargetUrl(service, req);
    const headers = this.proxyService.buildForwardedHeaders(req);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      // En la renovación, el refresh token viaja en una cookie httpOnly que el
      // frontend no puede leer: lo inyecta aquí el gateway.
      const cuerpo = this.sessionService.cuerpoReenviado(req, req.body);

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : JSON.stringify(cuerpo),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let data = await this.proxyService.parseResponseBody(response);

      // Login, registro, renovación y cierre de sesión se convierten aquí en
      // cookies; el cuerpo sale ya sin tokens.
      if (response.ok && this.sessionService.esRutaDeSesion(req.path)) {
        data = this.sessionService.aplicarRespuesta(req, res, data);
      }

      res.status(response.status).json(data);

      if (response.status >= SERVER_ERROR_THRESHOLD) {
        throw new HttpException(
          `Servicio ${service} respondió ${response.status}`,
          HttpStatus.BAD_GATEWAY
        );
      }
    } catch (error) {
      clearTimeout(timeout);
      throw this.proxyService.mapProxyError(service, error);
    }
  }
}
