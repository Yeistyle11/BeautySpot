import { ValueTransformer } from "typeorm";

/**
 * Convierte las columnas numeric/decimal de Postgres a `number`. El driver las
 * devuelve como string para no perder precisión, y sin esto `precio + envío`
 * concatena en vez de sumar. El `null` se conserva tal cual.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
