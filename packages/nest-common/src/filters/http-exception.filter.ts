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
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Error interno del servidor";
    let code = "INTERNAL_ERROR";
    let details: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === "object" && exResponse !== null) {
        const resp = exResponse as Record<string, unknown>;
        if (Array.isArray(resp.message)) {
          details = { validation: resp.message as string[] };
          message = "Error de validación";
          code = "VALIDATION_ERROR";
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
