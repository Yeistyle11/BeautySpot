import { Logger } from "@nestjs/common";

/** SQLSTATE que Postgres devuelve al abortar una transacción por serialización. */
const SERIALIZATION_FAILURE = "40001";
/** SQLSTATE de deadlock detectado; también es seguro reintentar. */
const DEADLOCK_DETECTED = "40P01";

const DEFAULT_MAX_ATTEMPTS = 3;
/**
 * Espera del primer reintento. Un conflicto de serialización se resuelve en
 * cuanto la otra transacción termina, así que el orden es el de milisegundos.
 */
const ESPERA_BASE_MS = 20;
const logger = new Logger("SerializableRetry");

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === SERIALIZATION_FAILURE || code === DEADLOCK_DETECTED;
}

/**
 * Espera del intento, al doble de la anterior y repartida al azar en ese tope.
 */
function esperaDelIntento(intento: number, baseMs: number): number {
  return Math.random() * baseMs * 2 ** (intento - 1);
}

/**
 * Ejecuta una operación reintentándola si Postgres aborta la transacción por un
 * conflicto de serialización o un deadlock: ese error es esperable y se resuelve
 * repitiendo. Los demás se propagan de inmediato.
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  esperaBaseMs: number = ESPERA_BASE_MS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }
      lastError = error;
      logger.warn(
        `Conflicto de serialización (intento ${attempt}/${maxAttempts}), reintentando`
      );
      await new Promise((sigue) =>
        setTimeout(sigue, esperaDelIntento(attempt, esperaBaseMs))
      );
    }
  }

  // Inalcanzable: el último intento relanza dentro del bucle.
  throw lastError;
}
