import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

/** Cabecera que transporta el identificador de la petición entre servicios. */
export const REQUEST_ID_HEADER = "x-request-id";

/** Datos que acompañan a una petición durante todo su recorrido. */
export interface ContextoPeticion {
  requestId: string;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

/** Identificador de la petición en curso, si la hay. */
export function requestIdActual(): string | undefined {
  return almacen.getStore()?.requestId;
}

/** Ejecuta `fn` con el contexto indicado disponible en toda su cadena async. */
export function conContextoPeticion<T>(
  contexto: ContextoPeticion,
  fn: () => T
): T {
  return almacen.run(contexto, fn);
}

/**
 * Asocia un identificador a cada petición y lo mantiene disponible durante todo
 * su procesamiento.
 *
 * Con ocho servicios y comunicación asíncrona, la pregunta operativa habitual no
 * es "¿qué pasó?" sino "¿qué pasó con ESTA petición?". Sin un identificador
 * común hay que cruzar a mano los logs de cuatro contenedores por marca de
 * tiempo.
 *
 * Se usa AsyncLocalStorage y no un parámetro explícito porque el identificador
 * tendría que atravesar controladores, servicios y repositorios sin que a
 * ninguno le importe: ensuciaría todas las firmas para que solo lo lea el
 * logger.
 *
 * Si la petición ya trae la cabecera —viene del gateway o de otro servicio— se
 * respeta; así el mismo identificador recorre todo el sistema. Se devuelve
 * también al cliente para que pueda citarlo al reportar un problema.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const entrante = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof entrante === "string" && entrante.length > 0
      ? entrante
      : randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  conContextoPeticion({ requestId }, () => next());
}
