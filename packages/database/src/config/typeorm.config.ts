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
    // Nunca al arrancar. Con varias réplicas del mismo servicio todas
    // competirían por migrar a la vez, y un fallo de migración dejaría al
    // servicio sin arrancar en lugar de fallar en un paso de despliegue
    // visible. Las migraciones se aplican con `npm run migration:run` antes
    // de levantar los contenedores (ver DEPLOY.md).
    migrationsRun: false,
    synchronize: !isProduction && synchronize,
    logging: loggingOptions,
    maxQueryExecutionTime: isProduction ? 1000 : 0,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
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
 * Opciones del DataSource que usa el CLI de TypeORM para ejecutar migraciones.
 *
 * No es el mismo DataSource que usa la aplicación: aquí `synchronize` está
 * siempre desactivado (crear el esquema por reflexión mientras se migra haría
 * inútil la propia migración) y se declara el patrón donde buscar los ficheros.
 * El patrón incluye `.ts` y `.js` porque el CLI corre sobre los fuentes con
 * ts-node en desarrollo y sobre `dist/` en el servidor.
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
