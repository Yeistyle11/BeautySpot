import {
  createTypeOrmConfig,
  createTypeOrmModuleOptions,
  getPoolConfig,
} from "./typeorm.config";

describe("TypeOrm Config", () => {
  const mockEntities = [class MockEntity1 {}, class MockEntity2 {}];

  describe("getPoolConfig", () => {
    it("debería retornar config de producción para read en producción", () => {
      const config = getPoolConfig("read", true);

      expect(config).toEqual({
        max: 50,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 2000,
      });
    });

    it("debería retornar config de producción para write en producción", () => {
      const config = getPoolConfig("write", true);

      expect(config).toEqual({
        max: 30,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    });

    it("debería retornar config de producción para default en producción", () => {
      const config = getPoolConfig("default", true);

      expect(config).toEqual({
        max: 40,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      });
    });

    it("debería retornar config de desarrollo para cualquier servicio", () => {
      const config = getPoolConfig("read", false);

      expect(config).toEqual({
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    });

    it("debería retornar config de desarrollo para default", () => {
      const config = getPoolConfig("default", false);

      expect(config).toEqual({
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    });
  });

  describe("createTypeOrmConfig", () => {
    const mockDatabaseUrl = "postgresql://user:pass@localhost:5432/db";

    it("debería crear config básica con parámetros por defecto", () => {
      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config).toMatchObject({
        type: "postgres",
        url: mockDatabaseUrl,
        entities: mockEntities,
        synchronize: false,
        extra: expect.any(Object),
      });
    });

    it("debería desactivar synchronize en producción", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = createTypeOrmConfig(
        mockDatabaseUrl,
        mockEntities,
        "default",
        true
      ) as any;

      expect(config.synchronize).toBe(false);
      expect(config.ssl).toEqual({ rejectUnauthorized: false });

      process.env.NODE_ENV = originalEnv;
    });

    it("debería activar synchronize en desarrollo con parámetro true", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = createTypeOrmConfig(
        mockDatabaseUrl,
        mockEntities,
        "default",
        true
      ) as any;

      expect(config.synchronize).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("debería desactivar synchronize en desarrollo con parámetro false", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = createTypeOrmConfig(
        mockDatabaseUrl,
        mockEntities,
        "default",
        false
      ) as any;

      expect(config.synchronize).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("debería incluir logging de queries en desarrollo", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config.logging).toContain("query");

      process.env.NODE_ENV = originalEnv;
    });

    it("debería incluir logging solo de errores en producción", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config.logging).toEqual(["error", "warn"]);
      expect(config.logging).not.toContain("query");

      process.env.NODE_ENV = originalEnv;
    });

    it("debería incluir pool config del servicio", () => {
      const config = createTypeOrmConfig(
        mockDatabaseUrl,
        mockEntities,
        "read"
      ) as any;

      expect(config.extra).toMatchObject({
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    });

    it("debería incluir application_name del servicio", () => {
      const originalServiceName = process.env.SERVICE_NAME;
      process.env.SERVICE_NAME = "test-service";

      const config = createTypeOrmConfig(
        mockDatabaseUrl,
        mockEntities,
        "read"
      ) as any;

      expect(config.extra?.application_name).toBe(
        "beautyspot-read-test-service"
      );

      if (originalServiceName) {
        process.env.SERVICE_NAME = originalServiceName;
      } else {
        delete process.env.SERVICE_NAME;
      }
    });

    it('debería usar "unknown" para application_name si SERVICE_NAME no está configurado', () => {
      const originalServiceName = process.env.SERVICE_NAME;
      delete process.env.SERVICE_NAME;

      const config = createTypeOrmConfig(
        mockDatabaseUrl,
        mockEntities,
        "read"
      ) as any;

      expect(config.extra?.application_name).toBe("beautyspot-read-unknown");

      if (originalServiceName) {
        process.env.SERVICE_NAME = originalServiceName;
      }
    });

    it("debería incluir maxQueryExecutionTime en producción", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config.maxQueryExecutionTime).toBe(1000);

      process.env.NODE_ENV = originalEnv;
    });

    it("debería no incluir maxQueryExecutionTime en desarrollo", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config.maxQueryExecutionTime).toBe(0);

      process.env.NODE_ENV = originalEnv;
    });

    it("debería incluir statement_timeout en producción", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config.extra?.statement_timeout).toBe(30000);

      process.env.NODE_ENV = originalEnv;
    });

    it("debería incluir query_timeout en producción", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = createTypeOrmConfig(mockDatabaseUrl, mockEntities) as any;

      expect(config.extra?.query_timeout).toBe(60000);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("createTypeOrmModuleOptions", () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;

    beforeEach(() => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    });

    afterEach(() => {
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    });

    it("debería lanzar error cuando DATABASE_URL no está configurado", () => {
      delete process.env.DATABASE_URL;

      expect(() => createTypeOrmModuleOptions(mockEntities)).toThrow(
        "DATABASE_URL no está configurado"
      );
    });

    it("debería crear opciones usando DATABASE_URL del entorno", () => {
      const config = createTypeOrmModuleOptions(mockEntities) as any;

      expect(config.url).toBe("postgresql://user:pass@localhost:5432/db");
      expect(config.entities).toEqual(mockEntities);
    });

    it("debería detectar producción desde NODE_ENV", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const config = createTypeOrmModuleOptions(mockEntities) as any;

      expect(config.synchronize).toBe(false);
      expect(config.ssl).toEqual({ rejectUnauthorized: false });

      process.env.NODE_ENV = originalEnv;
    });

    it("debería detectar desarrollo desde NODE_ENV", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = createTypeOrmModuleOptions(mockEntities) as any;

      expect(config.synchronize).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("service types", () => {
    it("debería soportar tipo read", () => {
      const config = createTypeOrmConfig("postgres://url", [], "read");

      expect(config.extra?.application_name).toContain("read");
    });

    it("debería soportar tipo write", () => {
      const config = createTypeOrmConfig("postgres://url", [], "write");

      expect(config.extra?.application_name).toContain("write");
    });

    it("debería soportar tipo default", () => {
      const config = createTypeOrmConfig("postgres://url", [], "default");

      expect(config.extra?.application_name).toContain("default");
    });
  });
});
