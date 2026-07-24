import { InternalServerErrorException } from "@nestjs/common";

const DEFAULT_WEAK_SECRETS = [
  "dev-jwt-secret-change-in-production",
  "dev-refresh-secret-change-in-production",
  "changeme",
  "secret",
];

const MIN_SECRET_LENGTH = 16;

/**
 * Valida el JWT secret al arrancar y aborta si es inseguro: ausente, con un valor
 * por defecto conocido o demasiado corto. Falla rápido en el bootstrap en vez de
 * dejar el servicio firmando tokens con un secreto adivinable.
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
