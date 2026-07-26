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
 * Asocia un identificador a cada petición, lo mantiene disponible durante su
 * procesamiento y lo devuelve en la respuesta. Respeta el que llegue en la
 * cabecera.
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
