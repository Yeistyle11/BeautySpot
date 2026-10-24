import {
  Controller,
  All,
  Req,
  Res,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Readable } from "node:stream";
import { Request, Response } from "express";
import { ProxyService, type CuerpoBinario } from "./proxy.service";
import { CircuitBreakerService } from "../circuit-breaker/circuit-breaker.service";
import {
  PROXY_TIMEOUT_MS,
  PROXY_TIMEOUT_SUBIDA_MS,
} from "@beautyspot/shared-constants";
import { UMBRAL_LENTO_MS } from "@beautyspot/nest-common";
import { SessionService } from "../session/session.service";

const SERVER_ERROR_THRESHOLD = 500;

/** Respuesta ya obtenida del microservicio, pendiente de escribir. */
interface RespuestaReenviada {
  estado: number;
  cuerpo: unknown;
  /** Presente cuando el servicio respondió un archivo y no JSON. */
  binario?: CuerpoBinario;
  /** Cabeceras de caché del servicio, que se devuelven tal cual. */
  cabeceras?: Record<string, string>;
}

/**
 * Un 5xx del microservicio: cuenta como fallo para el circuit breaker y lleva
 * consigo el cuerpo que hay que devolverle al cliente.
 */
class ErrorDeServicio extends HttpException {
  constructor(
    service: string,
    readonly respuesta: RespuestaReenviada
  ) {
    super(
      `Servicio ${service} respondió ${respuesta.estado}`,
      HttpStatus.BAD_GATEWAY
    );
  }
}

/**
 * Detecta intentos de subir de directorio en la ruta reenviada, tanto escritos
 * en claro como codificados (`%2e%2e`).
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
  private readonly logger = new Logger("Latencia");

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

    // Una sola escritura y fuera del breaker; la excepcion que cuenta el fallo
    // viaja despues.
    let respuesta: RespuestaReenviada;
    try {
      respuesta = await this.circuitBreaker.execute(service, () =>
        this.proxiedRequest(service, req, res)
      );
    } catch (error) {
      if (error instanceof ErrorDeServicio) {
        respuesta = error.respuesta;
      } else {
        throw error;
      }
    }

    for (const [nombre, valor] of Object.entries(respuesta.cabeceras ?? {})) {
      res.setHeader(nombre, valor);
    }

    if (respuesta.binario) {
      const { datos, tipo, disposicion } = respuesta.binario;
      res.setHeader("Content-Type", tipo);
      if (disposicion) res.setHeader("Content-Disposition", disposicion);
      res.status(respuesta.estado).send(datos);
      return;
    }

    res.status(respuesta.estado).json(respuesta.cuerpo);
  }

  /** Ejecuta el fetch reenviado con timeout y devuelve la respuesta del backend. */
  private async proxiedRequest(
    service: string,
    req: Request,
    res: Response
  ): Promise<RespuestaReenviada> {
    const targetUrl = this.proxyService.buildTargetUrl(service, req);
    const headers = this.proxyService.buildForwardedHeaders(req);
    const subida = this.proxyService.esSubida(req);
    if (subida) this.proxyService.validarSubida(req);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      subida ? PROXY_TIMEOUT_SUBIDA_MS : PROXY_TIMEOUT_MS
    );
    // Se mide solo el salto al backend, no lo que el gateway tarda en resolver
    // ruta y cabeceras.
    const comienzo = Date.now();

    try {
      // En la renovación, el refresh token viaja en una cookie httpOnly que el
      // frontend no puede leer: lo inyecta aquí el gateway.
      const cuerpo = this.sessionService.cuerpoReenviado(req, req.body);

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : subida
            ? // El archivo pasa en streaming: el gateway no lo carga entero.
              (Readable.toWeb(req) as unknown as BodyInit)
            : JSON.stringify(cuerpo),
        signal: controller.signal,
        ...(subida ? { duplex: "half" } : {}),
      } as RequestInit);
      clearTimeout(timeout);
      this.medirSalto(service, req, response.status, comienzo);

      const binario = await this.proxyService.leerBinario(response);
      let data = binario
        ? null
        : await this.proxyService.parseResponseBody(response);

      // Login, renovacion y cierre de sesion se convierten aqui en cookies,
      // tambien cuando la respuesta del servicio no es correcta.
      if (this.sessionService.esRutaDeSesion(req.path)) {
        data = this.sessionService.aplicarRespuesta(req, res, data);
      }

      const respuesta: RespuestaReenviada = {
        estado: response.status,
        cuerpo: data,
        ...(binario ? { binario } : {}),
        cabeceras: this.proxyService.cabecerasDeCache(response),
      };

      if (response.status >= SERVER_ERROR_THRESHOLD) {
        throw new ErrorDeServicio(service, respuesta);
      }

      return respuesta;
    } catch (error) {
      clearTimeout(timeout);
      // Un servicio que agota el timeout es el caso de latencia por excelencia:
      // dejarlo sin medir esconde justo al que peor se está portando.
      if (!(error instanceof ErrorDeServicio)) {
        this.medirSalto(service, req, "error", comienzo);
      }
      throw this.proxyService.mapProxyError(service, error);
    }
  }

  /**
   * Deja en el log lo que tardo el servicio de destino, con el `requestId` que
   * estampa `StructuredLogger`.
   */
  private medirSalto(
    service: string,
    req: Request,
    estado: number | "error",
    comienzo: number
  ): void {
    const ms = Date.now() - comienzo;
    const linea = `${service} ${req.method} ${req.path} ${estado} ${ms}ms`;

    if (ms >= UMBRAL_LENTO_MS) this.logger.warn(linea);
    else this.logger.log(linea);
  }
}
