import { config } from "dotenv";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { DataSource, DataSourceOptions } from "typeorm";

/** Raíz del monorepo, subiendo desde `tools/seed/src`. */
export const RAIZ = resolve(__dirname, "..", "..", "..");

/** Servicios cuya base toca la siembra, en el orden en que se escriben. */
export const SERVICIOS = [
  "auth",
  "core",
  "booking",
  "payment",
  "marketplace",
  "analytics",
] as const;

export type Servicio = (typeof SERVICIOS)[number];

/**
 * Lee el `DATABASE_URL` de un servicio de su propio `.env`, el mismo del que lo
 * lee al arrancar. No se toca `process.env`: son seis bases distintas y `dotenv`
 * no pisa lo ya cargado, así que la primera lectura ganaría para todas.
 */
function urlDeLaBase(servicio: Servicio): string {
  const ruta = join(RAIZ, "services", `${servicio}-service`, ".env");
  if (!existsSync(ruta)) {
    throw new Error(
      `Falta services/${servicio}-service/.env. Cópialo de su .env.example ` +
        `(CLAUDE.md trae la línea que copia los siete de golpe).`
    );
  }

  const url = config({ processEnv: {}, path: ruta }).parsed?.DATABASE_URL;
  if (!url) {
    throw new Error(
      `services/${servicio}-service/.env no define DATABASE_URL.`
    );
  }
  return url;
}

/**
 * Anfitriones a los que la siembra acepta conectarse sin insistencia. Escribe
 * filas de mentira: apuntarla a una base que no sea local tiene que costar un
 * gesto explícito.
 */
const ANFITRIONES_LOCALES = ["localhost", "127.0.0.1", "::1", "postgres"];

/** Comprueba que la URL apunta a una base local, o exige `--forzar`. */
function exigirBaseLocal(servicio: Servicio, url: string, forzar: boolean) {
  const anfitrion = new URL(url).hostname;
  if (ANFITRIONES_LOCALES.includes(anfitrion) || forzar) return;
  throw new Error(
    `La base de ${servicio}-service apunta a "${anfitrion}", que no es local. ` +
      `La siembra escribe datos de prueba: si de verdad es ahí donde los ` +
      `quieres, repite con --forzar.`
  );
}

/**
 * Abre una conexión por base. `synchronize` deriva el esquema de las entidades,
 * igual que hace cada servicio fuera de producción, así que la siembra funciona
 * sobre un volumen recién creado sin arrancar los servicios.
 */
export async function conectar(
  servicio: Servicio,
  entidades: DataSourceOptions["entities"],
  opciones: { forzar: boolean }
): Promise<DataSource> {
  const url = urlDeLaBase(servicio);
  exigirBaseLocal(servicio, url, opciones.forzar);

  const dataSource = new DataSource({
    type: "postgres",
    url,
    entities: entidades,
    synchronize: true,
    logging: false,
  });

  try {
    await dataSource.initialize();
  } catch (error) {
    throw new Error(
      `No se pudo conectar con la base de ${servicio}-service. ` +
        `¿Está Postgres arriba? (npm run docker:up, publica el 5433). ` +
        `Detalle: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return dataSource;
}

/**
 * Producción no se siembra. La comprobación va antes que ninguna conexión: es
 * más barato negarse por el entorno que por el anfitrión.
 */
export function rechazarProduccion(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NODE_ENV=production: la siembra crea cuentas con una contraseña " +
        "conocida y no debe correr contra un entorno real."
    );
  }
}
