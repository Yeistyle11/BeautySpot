import { InternalServerErrorException } from "@nestjs/common";
import { DEFAULT_WEAK_SECRETS, MIN_SECRET_LENGTH } from "./secretos";

/**
 * Valida el JWT secret donde se va a usar y aborta si es inseguro: ausente,
 * con un valor por defecto conocido o demasiado corto.
 */
export function assertJwtSecret(
  secret: string | undefined,
  envVarName: string
): string {
  if (!secret) {
    throw new InternalServerErrorException(
      `${envVarName} no está configurado. La aplicación no puede iniciar sin un JWT secret.`
    );
  }

  if (DEFAULT_WEAK_SECRETS.includes(secret)) {
    throw new InternalServerErrorException(
      `${envVarName} tiene un valor por defecto inseguro (${secret}). Configure un secret fuerte en producción.`
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new InternalServerErrorException(
      `${envVarName} es demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres).`
    );
  }

  return secret;
}
