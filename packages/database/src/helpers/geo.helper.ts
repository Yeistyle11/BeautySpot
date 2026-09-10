/**
 * Radio medio de la Tierra en kilómetros, que es lo que convierte el ángulo
 * entre dos puntos en una distancia.
 */
const RADIO_TERRESTRE_KM = 6371;

/**
 * Expresión SQL con la distancia en kilómetros entre la fila y un punto, por la
 * fórmula del semiverseno; la comparten filtro y orden para no pedir dos juegos
 * de parámetros del mismo punto. Los valores viajan por `setParameters`.
 */
export function distanciaEnKm(
  alias: string,
  parametros: { lat: string; lng: string } = { lat: "lat", lng: "lng" }
): string {
  const { lat, lng } = parametros;

  return (
    `(${RADIO_TERRESTRE_KM} * acos(` +
    `cos(radians(:${lat})) * cos(radians(${alias}.lat)) * ` +
    `cos(radians(${alias}.lng) - radians(:${lng})) + ` +
    `sin(radians(:${lat})) * sin(radians(${alias}.lat))` +
    `))`
  );
}
