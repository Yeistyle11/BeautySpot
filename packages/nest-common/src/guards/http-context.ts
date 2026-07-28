import { ExecutionContext } from "@nestjs/common";

/**
 * Indica si la ejecución proviene de una petición HTTP. Los manejadores de
 * eventos de RabbitMQ atraviesan los mismos guards globales y no tienen
 * petición ni usuario que inspeccionar.
 */
export function esContextoHttp(context: ExecutionContext): boolean {
  return context.getType() === "http";
}
