/** Decimales con los que se publica una tasa. */
const DECIMALES = 1;

/**
 * Porcentaje de `part` sobre `total`, con un decimal; 0 si el total es cero. El
 * decimal es lo que deja ver el movimiento que la tasa vigila —del 92,4 % al
 * 91,6 %— y lo que evita que dos pantallas den «7 %» y «7.0 %».
 */
export function porcentaje(part: number, total: number): number {
  if (total <= 0) return 0;
  const factor = 10 ** DECIMALES;
  return Math.round((part / total) * 100 * factor) / factor;
}
