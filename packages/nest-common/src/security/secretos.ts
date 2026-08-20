/**
 * Secretos que nunca deben llegar a un despliegue: los de ejemplo y los de los
 * .env.test, que estan versionados.
 */
export const DEFAULT_WEAK_SECRETS = [
  "dev-jwt-secret-change-in-production",
  "dev-refresh-secret-change-in-production",
  "changeme",
  "secret",
  "test_secret_key_for_testing_only_do_not_use_in_production",
  "test_refresh_secret_for_testing_only_do_not_use_in_production",
  "test_internal_secret_for_testing_only",
];

/**
 * Longitud minima del secreto: HS256 usa una clave de 256 bits, asi que por
 * debajo de 32 caracteres se firma con menos entropia.
 */
export const MIN_SECRET_LENGTH = 32;
