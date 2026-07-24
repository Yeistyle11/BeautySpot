import { ConfigService } from "@nestjs/config";

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/** Orígenes de desarrollo local aceptados fuera de producción. */
const LOCAL_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Política CORS resultante: callback que autoriza el origen y flag de credenciales. */
export interface CorsOptions {
  origin: (origin: string | undefined, callback: OriginCallback) => void;
  credentials: boolean;
}

/**
 * Construye la política CORS compartida por el gateway y los microservicios.
 *
 * Como las respuestas se emiten con `credentials: true`, el origen no puede
 * reflejarse sin más: cualquier sitio al que se le devuelva su propio Origin
 * podría leer respuestas autenticadas del usuario. Por eso solo se aceptan los
 * orígenes declarados en CORS_ORIGINS y, fuera de producción, los locales.
 */
export function buildCorsOptions(configService: ConfigService): CorsOptions {
  const allowedOrigins = (configService.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = configService.get<string>("NODE_ENV") === "production";

  return {
    origin(origin, callback) {
      // Sin cabecera Origin no hay petición cross-origin que restringir
      // (health checks, llamadas servidor a servidor, curl).
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      if (!isProduction && LOCAL_ORIGIN_PATTERN.test(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  };
}
