import { InternalServerErrorException } from "@nestjs/common";

/**
 * Secretos que nunca deben llegar a un despliegue: los de ejemplo y los de los
 * ficheros .env.test, que están versionados y superan la longitud mínima, de
 * modo que copiarlos por error no lo detectaría nada más.
 */
const DEFAULT_WEAK_SECRETS = [
  "dev-jwt-secret-change-in-production",
  "dev-refresh-secret-change-in-production",
  "changeme",
  "secret",
  "test_secret_key_for_testing_only_do_not_use_in_production",
  "test_refresh_secret_for_testing_only_do_not_use_in_production",
  "test_internal_secret_for_testing_only",
];

/**
 * Longitud mínima del secreto. HS256 usa una clave de 256 bits, así que por
 * debajo de 32 caracteres se firma con menos entropía de la que el algoritmo
 * supone; los .env.example ya piden 32.
 */
const MIN_SECRET_LENGTH = 32;

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
