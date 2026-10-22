import { DataSourceOptions, LogLevel } from "typeorm";

export type ServiceType = "read" | "write" | "default";

/**
 * Clase de entidad de TypeORM. Se tipa como constructor en vez de `Function`
 * porque `Function` admite cualquier invocable (una funcion suelta, un metodo)
 * y aqui solo tienen sentido las clases decoradas con @Entity.
 */
export type EntityClass = abstract new (...args: never[]) => unknown;

export interface PoolConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * Conexiones que abre cada servicio en producción. Los siete comparten un mismo
 * Postgres con `max_connections` de 100: analytics (read) más los seis de
 * escritura suman 75 y dejan sitio a las migraciones y a una consola. Pasarse
 * no da más capacidad, hace que Postgres rechace conexiones bajo carga y que
 * caigan todos los servicios a la vez.
 */
const POOLS_DE_PRODUCCION: Record<ServiceType, PoolConfig> = {
  read: { max: 15, idleTimeoutMillis: 10000, connectionTimeoutMillis: 2000 },
  write: { max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 },
  default: {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  },
};

/** `DB_POOL_MAX` del servicio, si es un entero positivo. */
function maximoDelEntorno(): number | undefined {
  const valor = Number(process.env.DB_POOL_MAX);
  return Number.isInteger(valor) && valor > 0 ? valor : undefined;
}

/**
 * Pool del servicio según su tipo y el entorno. `DB_POOL_MAX` sustituye el
 * máximo, para cuando Postgres admite más conexiones o hay un PgBouncer delante.
 */
export function getPoolConfig(
  serviceType: ServiceType,
  isProduction: boolean
): PoolConfig {
  const base = isProduction
    ? POOLS_DE_PRODUCCION[serviceType]
    : { max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };

  return { ...base, max: maximoDelEntorno() ?? base.max };
}

/** Niveles de registro de TypeORM según DB_LOGGING y el entorno. */
function logLevels(isProduction: boolean): LogLevel[] {
  const base: LogLevel[] = ["error", "warn"];
  const pedido = process.env.DB_LOGGING;

  if (pedido === "query") return [...base, "query"];
  if (pedido === "none") return [];
  if (
    pedido === undefined &&
    !isProduction &&
    process.env.NODE_ENV === "development"
  ) {
    return [...base, "query"];
  }
  return base;
}

/**
 * TLS de la conexión a Postgres: en producción valida el certificado del
 * servidor, con la CA de DATABASE_CA_CERT si se indica.
 */
function sslOptions(
  isProduction: boolean
): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!isProduction) return false;

  const ca = process.env.DATABASE_CA_CERT;
  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

export function createTypeOrmConfig(
  databaseUrl: string,
  entities: EntityClass[],
  serviceType: ServiceType = "default",
  synchronize = false,
  migrations: string[] = []
): DataSourceOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const poolConfig = getPoolConfig(serviceType, isProduction);

  const loggingOptions = logLevels(isProduction);

  return {
    type: "postgres",
    url: databaseUrl,
    entities,
    migrations,
    // Las migraciones se aplican con `npm run migration:run` (ver DEPLOY.md).
    migrationsRun: false,
    synchronize: !isProduction && synchronize,
    logging: loggingOptions,
    maxQueryExecutionTime: isProduction ? 1000 : 0,
    ssl: sslOptions(isProduction),
    extra: {
      ...poolConfig,
      application_name: `beautyspot-${serviceType}-${process.env.SERVICE_NAME || "unknown"}`,
      statement_timeout: isProduction ? 30000 : 0,
      query_timeout: isProduction ? 60000 : 0,
    },
  };
}

export function createTypeOrmModuleOptions(
  entities: EntityClass[],
  serviceType: ServiceType = "default"
): DataSourceOptions {
  return createTypeOrmConfig(requireDatabaseUrl(), entities, serviceType, true);
}

/**
 * Opciones del DataSource que usa el CLI de TypeORM: sin `synchronize` y con el
 * patrón de migraciones en `.ts` y `.js`.
 */
export function createMigrationDataSourceOptions(
  entities: EntityClass[],
  migrationsDir: string
): DataSourceOptions {
  return createTypeOrmConfig(requireDatabaseUrl(), entities, "default", false, [
    `${migrationsDir}/*.{ts,js}`,
  ]);
}

/** Lee DATABASE_URL o falla con un mensaje explícito en vez de conectar a un destino vacío. */
function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurado");
  }
  return databaseUrl;
}
