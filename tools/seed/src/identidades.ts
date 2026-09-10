import { createHash } from "crypto";

/**
 * Espacio de nombres de la siembra. Va en el hash para que estos identificadores
 * no puedan coincidir con los de ninguna otra cosa que derive UUID de un texto.
 */
const ESPACIO = "beautyspot.seed.v1";

/**
 * UUID estable a partir de un nombre, de versión 5 (SHA-1 sobre el nombre): la
 * misma etiqueta da siempre el mismo identificador. Es lo que hace la siembra
 * repetible sin borrar nada, y lo que deja apuntar un id en un documento de QA.
 */
export function idDe(nombre: string): string {
  const resumen = createHash("sha1").update(`${ESPACIO}:${nombre}`).digest();
  const bytes = Buffer.from(resumen.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versión 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * Generador pseudoaleatorio determinista (mulberry32). La siembra reparte citas,
 * importes y valoraciones con él y no con `Math.random`, para que dos
 * ejecuciones produzcan el mismo escenario.
 */
export function generador(semilla: string): () => number {
  let estado = createHash("sha1").update(semilla).digest().readUInt32BE(0);
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elemento de `opciones` elegido con el generador. */
export function unoDe<T>(azar: () => number, opciones: readonly T[]): T {
  return opciones[Math.floor(azar() * opciones.length)];
}

/** Entero entre `desde` y `hasta`, ambos incluidos. */
export function entero(azar: () => number, desde: number, hasta: number) {
  return desde + Math.floor(azar() * (hasta - desde + 1));
}
