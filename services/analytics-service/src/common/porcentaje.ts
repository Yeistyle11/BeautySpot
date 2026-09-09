/** Decimales con los que se publica una tasa. */
const DECIMALES = 1;

/**
 * Porcentaje de `part` sobre `total`, con un decimal; 0 si el total es cero.
 *
 * Redondear a entero borraba justo el movimiento que la tasa sirve para
 * vigilar: en un salón con trescientas citas al mes, una caída del 92,4 % al
 * 91,6 % se leía como «92 % → 92 %», es decir, no se veía. El decimal es
 * también lo que evita que dos pantallas del mismo producto den «7 %» y «7.0 %»
 * para el mismo dato.
 */
export function porcentaje(part: number, total: number): number {
  if (total <= 0) return 0;
  const factor = 10 ** DECIMALES;
  return Math.round((part / total) * 100 * factor) / factor;
}
