/**
 * Secretos que nunca deben llegar a un despliegue: los de ejemplo y los de los
 * ficheros .env.test, que están versionados y superan la longitud mínima, de
 * modo que copiarlos por error no lo detectaría nada más.
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
 * Longitud mínima del secreto. HS256 usa una clave de 256 bits, así que por
 * debajo de 32 caracteres se firma con menos entropía de la que el algoritmo
 * supone; los .env.example ya piden 32.
 */
export const MIN_SECRET_LENGTH = 32;
