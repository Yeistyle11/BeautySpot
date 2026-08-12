import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { esContextoHttp } from "../guards/http-context";

/**
 * A partir de aquí una petición se considera lenta y se registra como aviso.
 *
 * No es un objetivo de servicio, es el umbral por encima del cual merece la
 * pena mirar: por debajo, el ruido taparía lo que importa.
 */
export const UMBRAL_LENTO_MS = 1000;

/**
 * Mide lo que tarda cada petición y lo deja en el log.
 *
 * Con ocho servicios detrás de un gateway, saber que "algo va lento" no sirve
 * de nada si no se sabe dónde. Cada línea sale con el `requestId` que estampa
 * `StructuredLogger`, así que una petición se puede seguir de punta a punta
 * sumando lo que tardó en cada salto.
 *
 * Los errores no se registran aquí: de eso ya se ocupa `HttpExceptionFilter`,
 * y duplicarlo daría dos líneas por el mismo fallo.
 */
@Injectable()
export class LatenciaInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Latencia");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!esContextoHttp(context)) return next.handle();

    const request = context.switchToHttp().getRequest();
    const comienzo = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.registrar(request, context, comienzo),
        // También se mide lo que falla: una petición que tarda tres segundos en
        // dar un error es un problema de rendimiento, no solo de corrección.
        error: () => this.registrar(request, context, comienzo),
      })
    );
  }

  /** Escribe la línea con la ruta, el estado y lo que tardó. */
  private registrar(
    request: { method?: string; route?: { path?: string }; url?: string },
    context: ExecutionContext,
    comienzo: number
  ): void {
    const ms = Date.now() - comienzo;
    const estado = context.switchToHttp().getResponse()?.statusCode;
    // La ruta con su patrón (`/appointments/:id`) y no la URL concreta: si no,
    // cada identificador sería una ruta distinta y no se podrían agregar.
    const ruta = request.route?.path ?? request.url ?? "desconocida";
    const linea = `${request.method ?? "?"} ${ruta} ${estado ?? "-"} ${ms}ms`;

    if (ms >= UMBRAL_LENTO_MS) this.logger.warn(linea);
    else this.logger.log(linea);
  }
}
