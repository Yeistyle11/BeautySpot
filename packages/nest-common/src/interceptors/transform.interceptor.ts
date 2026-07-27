import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, map } from "rxjs";

/** Sobre estándar de una respuesta exitosa de la API. */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Envuelve todas las respuestas exitosas en el sobre {@link ApiResponse} para que
 * el frontend reciba siempre la misma forma ({ success, data, timestamp }).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T> | T> {
    // Un manejador de eventos de RabbitMQ no devuelve una respuesta HTTP: el
    // sobre no aplica y el consumidor avisa de que debería devolver void.
    if (context.getType() !== "http") return next.handle();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
      }))
    );
  }
}
