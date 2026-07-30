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

export function getPoolConfig(
  serviceType: ServiceType,
  isProduction: boolean
): PoolConfig {
  if (isProduction) {
    const productionConfigs = {
      read: {
        max: 50,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 2000,
      },
      write: {
        max: 30,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      },
      default: {
        max: 40,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      },
    };
    return productionConfigs[serviceType];
  }

  return {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

/**
 * TLS de la conexión a Postgres.
 *
 * En producción se valida el certificado del servidor: sin validarlo, el cifrado
 * no protege de un intermediario que se haga pasar por la base de datos, y por
 * ahí pasan las credenciales y todos los datos. Con un certificado propio (una
 * CA interna o un proveedor gestionado), se indica en DATABASE_CA_CERT. Solo se
 * puede rebajar poniendo DATABASE_SSL_REJECT_UNAUTHORIZED=false de forma
 * explícita, para no dejarlo desprotegido por descuido.
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

  const loggingOptions: LogLevel[] = isProduction
    ? (["error", "warn"] as LogLevel[])
    : (["query", "error", "warn"] as LogLevel[]);

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
