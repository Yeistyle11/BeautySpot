import { Logger } from "@nestjs/common";

/** SQLSTATE que Postgres devuelve al abortar una transacción por serialización. */
const SERIALIZATION_FAILURE = "40001";
/** SQLSTATE de deadlock detectado; también es seguro reintentar. */
const DEADLOCK_DETECTED = "40P01";

const DEFAULT_MAX_ATTEMPTS = 3;
const logger = new Logger("SerializableRetry");

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === SERIALIZATION_FAILURE || code === DEADLOCK_DETECTED;
}

/**
 * Ejecuta una operación reintentándola si Postgres aborta la transacción por un
 * conflicto de serialización o un deadlock: ese error es esperable y se resuelve
 * repitiendo. Los demás se propagan de inmediato.
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
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
    }
  }

  // Inalcanzable: el último intento relanza dentro del bucle.
  throw lastError;
}
