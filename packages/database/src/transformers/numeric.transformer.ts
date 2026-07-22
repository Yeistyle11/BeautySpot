import { ValueTransformer } from "typeorm";

/**
 * Convierte las columnas numeric/decimal de Postgres a `number` en JavaScript.
 *
 * El driver de Postgres devuelve estas columnas como string para no perder
 * precisión. Sin este transformer, un campo tipado como `number` llega como
 * texto y operaciones como `precio + envío` concatenan ("100" + 50 = "10050")
 * en vez de sumar. Aplicar el transformer centraliza la conversión y evita
 * tener que envolver cada lectura en `Number(...)`.
 *
 * `null` se preserva tal cual para columnas anulables.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
