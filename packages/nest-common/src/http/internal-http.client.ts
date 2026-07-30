import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Microservicios a los que se puede llamar por HTTP interno. */
export type ServicioInterno =
  | "auth"
  | "core"
  | "booking"
  | "payment"
  | "notification"
  | "marketplace"
  | "analytics";

/** Puerto local de cada servicio, para cuando no hay variable de entorno. */
const PUERTOS: Record<ServicioInterno, number> = {
  auth: 3001,
  core: 3002,
  booking: 3003,
  payment: 3004,
  notification: 3005,
  marketplace: 3006,
  analytics: 3007,
};

const TIMEOUT_POR_DEFECTO_MS = 5000;

/** Ajustes de una llamada concreta. */
export interface OpcionesLlamada {
  timeoutMs?: number;
  /** Qué se hace si el servicio responde 404: fallar (por defecto) o devolver null. */
  noEncontradoComoNulo?: boolean;
}

/**
 * Cliente de las llamadas HTTP entre microservicios (`/internal/*`).
 *
 * Existía una copia de este código en cada servicio que necesitaba preguntar a
 * otro, y habían ido divergiendo: una sin tiempo límite —capaz de retener un
 * worker hasta que el destino cerrase la conexión—, otra que enviaba el secreto
 * solo si no estaba vacío, y tres formas distintas de sacar el dato del sobre
 * `{ success, data }`, una de ellas sin comprobar que existiera.
 *
 * `pedir` falla si el otro servicio no responde; `pedirONulo` devuelve null. La
 * elección es del que llama, porque no siempre es la misma: bloquear la acción
 * es lo correcto al verificar una condición de negocio, y seguir adelante lo es
 * al adornar un correo con datos accesorios.
 */
@Injectable()
export class InternalHttpClient {
  private readonly logger = new Logger(InternalHttpClient.name);

  constructor(private readonly configService: ConfigService) {}

  /** Pide un recurso a otro servicio; falla si no se puede obtener. */
  async pedir<T>(
    servicio: ServicioInterno,
    ruta: string,
    opciones: OpcionesLlamada = {}
  ): Promise<T | null> {
    return this.ejecutar<T>(servicio, ruta, opciones);
  }

  /** Envía datos a otro servicio; falla si no se puede completar. */
  async enviar<T>(
    servicio: ServicioInterno,
    ruta: string,
    cuerpo: unknown,
    opciones: OpcionesLlamada = {}
  ): Promise<T | null> {
    return this.ejecutar<T>(servicio, ruta, opciones, cuerpo);
  }

  /** Resuelve la URL, llama y desenvuelve la respuesta. */
  private async ejecutar<T>(
    servicio: ServicioInterno,
    ruta: string,
    opciones: OpcionesLlamada,
    cuerpo?: unknown
  ): Promise<T | null> {
    const url = `${this.urlDe(servicio)}${ruta}`;
    const respuesta = await this.llamar(servicio, url, opciones, cuerpo);

    if (respuesta.status === 404 && opciones.noEncontradoComoNulo) return null;

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        `${servicio}-service respondió ${respuesta.status} en ${ruta}`
      );
    }

    return this.desenvolver<T>(servicio, ruta, await this.leerJson(respuesta));
  }

  /**
   * Igual que {@link pedir} pero devuelve null si el otro servicio falla, en
   * lugar de propagar el error. Para datos accesorios, no para comprobaciones.
   */
  async pedirONulo<T>(
    servicio: ServicioInterno,
    ruta: string,
    opciones: OpcionesLlamada = {}
  ): Promise<T | null> {
    try {
      return await this.pedir<T>(servicio, ruta, opciones);
    } catch (error: unknown) {
      this.logger.warn(
        `No se pudo consultar ${servicio}${ruta}: ${this.mensaje(error)}`
      );
      return null;
    }
  }

  /** Ejecuta la petición con secreto interno y tiempo límite. */
  private async llamar(
    servicio: ServicioInterno,
    url: string,
    opciones: OpcionesLlamada,
    cuerpo?: unknown
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method: cuerpo === undefined ? "GET" : "POST",
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        headers: {
          "x-internal-secret": this.secreto(),
          ...(cuerpo === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        // Sin límite, un servicio colgado retiene el worker que espera hasta
        // que el sistema operativo corte la conexión.
        signal: AbortSignal.timeout(
          opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS
        ),
      });
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        `${servicio}-service no está disponible: ${this.mensaje(error)}`
      );
    }
  }

  /** Lee el cuerpo como JSON, o falla si no lo es. */
  private async leerJson(respuesta: Response): Promise<unknown> {
    try {
      return await respuesta.json();
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        `Respuesta no interpretable: ${this.mensaje(error)}`
      );
    }
  }

  /**
   * Saca el dato del sobre `{ success, data }` que ponen los microservicios.
   *
   * Se acepta también una respuesta sin sobre para no atarse a que todas las
   * rutas internas lo usen, pero un sobre con `data` ausente es un fallo: darlo
   * por bueno propagaba un undefined que reventaba lejos del origen.
   */
  private desenvolver<T>(
    servicio: ServicioInterno,
    ruta: string,
    cuerpo: unknown
  ): T {
    if (typeof cuerpo !== "object" || cuerpo === null) return cuerpo as T;

    const registro = cuerpo as Record<string, unknown>;
    if (!("success" in registro) && !("data" in registro)) return cuerpo as T;

    if (!("data" in registro)) {
      throw new ServiceUnavailableException(
        `${servicio}-service devolvió una respuesta sin datos en ${ruta}`
      );
    }

    return registro.data as T;
  }

  /** URL base del servicio, de su variable de entorno o del puerto local. */
  private urlDe(servicio: ServicioInterno): string {
    const variable = `${servicio.toUpperCase()}_SERVICE_URL`;
    return this.configService.get<string>(
      variable,
      `http://localhost:${PUERTOS[servicio]}`
    );
  }

  private secreto(): string {
    return this.configService.get<string>("INTERNAL_API_SECRET", "");
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
