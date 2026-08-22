/**
 * Radio medio de la Tierra en kilómetros, que es lo que convierte el ángulo
 * entre dos puntos en una distancia.
 */
const RADIO_TERRESTRE_KM = 6371;

/**
 * Expresión SQL con la distancia en kilómetros entre la fila y un punto, por la
 * fórmula del semiverseno. Sirve tanto para filtrar («a menos de N km») como
 * para ordenar por cercanía, y se genera aquí para que las dos usen la misma:
 * escritas a mano, filtro y orden acababan pidiendo dos juegos de parámetros
 * para el mismo punto.
 *
 * Los nombres son de parámetros de consulta, nunca de entrada del usuario: el
 * valor viaja por `setParameters` y no por la cadena.
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
