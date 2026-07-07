import { DataSourceOptions, LogLevel } from "typeorm";

export type ServiceType = "read" | "write" | "default";

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
  entities: Function[],
  serviceType: ServiceType = "default",
  synchronize = false
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
  entities: Function[],
  serviceType: ServiceType = "default"
): DataSourceOptions {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurado");
  }
  return createTypeOrmConfig(databaseUrl, entities, serviceType, true);
}
