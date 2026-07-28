import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

/**
 * Filtro global que normaliza cualquier excepción a un cuerpo de error uniforme
 * ({ success:false, error:{ code, message, details }, statusCode, timestamp }).
 *
 * Traduce los errores de validación (mensajes en arreglo) y los estados HTTP más
 * comunes a códigos estables, y solo registra en el log los fallos 5xx.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // Un manejador de eventos de RabbitMQ no tiene respuesta que escribir: se
    // relanza para que el consumidor rechace el mensaje y acabe en la DLQ.
    if (host.getType() !== "http") throw exception;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Error interno del servidor";
    let code = "INTERNAL_ERROR";
    let details: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();
      let codigoPropio: string | undefined;

      if (typeof exResponse === "object" && exResponse !== null) {
        const resp = exResponse as Record<string, unknown>;
        const sobre = resp.error as
          | { code?: string; message?: string }
          | undefined;
        if (Array.isArray(resp.message)) {
          details = { validation: resp.message as string[] };
          message = "Error de validación";
          code = "VALIDATION_ERROR";
        } else if (sobre?.message) {
          // La excepción ya trae el sobre formado.
          message = sobre.message;
          codigoPropio = sobre.code;
        } else {
          message = (resp.message as string) || exception.message;
        }
      } else {
        message = exception.message;
      }

      if (statusCode === HttpStatus.UNAUTHORIZED) code = "AUTH_UNAUTHORIZED";
      if (statusCode === HttpStatus.FORBIDDEN) code = "AUTH_FORBIDDEN";
      if (statusCode === HttpStatus.NOT_FOUND) code = "NOT_FOUND";
      if (statusCode === HttpStatus.BAD_REQUEST) code = "VALIDATION_ERROR";
      if (statusCode === HttpStatus.CONFLICT) code = "CONFLICT";
      if (statusCode === HttpStatus.TOO_MANY_REQUESTS)
        code = "RATE_LIMIT_EXCEEDED";

      if (codigoPropio) code = codigoPropio;
    }

    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(statusCode).json({
      success: false,
      error: { code, message, details },
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }
}
