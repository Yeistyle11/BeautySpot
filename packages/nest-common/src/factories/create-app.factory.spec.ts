import { StructuredLogger } from "../observability/structured.logger";
import { createMicroserviceApp } from "./create-app.factory";
import { ValidationPipe } from "@nestjs/common";

jest.mock("@nestjs/core", () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock("ioredis", () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    disconnect: jest.fn(),
  };
  const fn = jest.fn(() => mockRedis);
  return { __esModule: true, default: fn, Redis: fn };
});

/**
 * Configuración mínima con la que la fábrica deja arrancar. Se declara aquí
 * porque desde este cambio un servicio sin entorno no llega ni a construirse:
 * el bootstrap valida antes de crear la aplicación.
 */
const ENTORNO_VALIDO = {
  JWT_SECRET: "9f3a7c1e5b2d8a4f6c0e9b3d7a1f5c8e",
  INTERNAL_API_SECRET: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  DATABASE_URL: "postgresql://u:p@localhost:5433/db",
  RABBITMQ_URL: "amqp://u:p@localhost:5672",
};

describe("createAppFactory", () => {
  let NestFactoryMock: any;
  let mockApp: any;
  let mockConfigService: any;
  let entornoOriginal: NodeJS.ProcessEnv;

  beforeEach(() => {
    entornoOriginal = process.env;
    process.env = { ...process.env, ...ENTORNO_VALIDO };
  });

  afterEach(() => {
    process.env = entornoOriginal;
  });

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: any = {
          CORS_ORIGINS: "http://localhost:3000,https://example.com",
        };
        return config[key];
      }),
    };

    mockApp = {
      get: jest.fn().mockReturnValue(mockConfigService),
      use: jest.fn().mockReturnThis(),
      enableCors: jest.fn().mockReturnThis(),
      enableShutdownHooks: jest.fn().mockReturnThis(),
      useGlobalPipes: jest.fn().mockReturnThis(),
      useGlobalGuards: jest.fn().mockReturnThis(),
      useGlobalFilters: jest.fn().mockReturnThis(),
      useGlobalInterceptors: jest.fn().mockReturnThis(),
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    NestFactoryMock = {
      create: jest.fn().mockResolvedValue(mockApp),
    };

    (require("@nestjs/core").NestFactory as any) = NestFactoryMock;
  });

  describe("constructor", () => {
    it("debería crear aplicación NestJS con el logger estructurado", async () => {
      await createMicroserviceApp({} as any);

      expect(NestFactoryMock.create).toHaveBeenCalledWith(
        {} as any,
        expect.objectContaining({ logger: expect.any(StructuredLogger) })
      );
    });
  });

  describe("validación del entorno", () => {
    // Un contenedor que levanta verde y falla con la primera petición se
    // descubre cuando ya hay tráfico encima.
    it("no construye la aplicación si falta configuración", async () => {
      delete process.env.JWT_SECRET;

      await expect(createMicroserviceApp({} as any)).rejects.toThrow(
        /JWT_SECRET/
      );
      expect(NestFactoryMock.create).not.toHaveBeenCalled();
    });

    it("exige también las URLs de infraestructura", async () => {
      process.env.DATABASE_URL = "localhost:5433";

      await expect(createMicroserviceApp({} as any)).rejects.toThrow(
        /DATABASE_URL no es una URL válida/
      );
    });

    it("admite exigencias propias del servicio que arranca", async () => {
      await expect(
        createMicroserviceApp({} as any, { obligatorias: ["SMTP_HOST"] })
      ).rejects.toThrow(/SMTP_HOST no está definida/);
    });
  });

  describe("CORS configuration", () => {
    it("debería habilitar CORS con configuración personalizada", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: expect.any(Function),
        credentials: true,
      });
    });

    it("debería permitir orígenes configurados", async () => {
      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback("https://example.com", (err: any, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
      });
    });

    it("debería permitir orígenes localhost", async () => {
      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback("http://localhost:3000", (err: any, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
      });
    });

    it("debería denegar orígenes desconocidos en desarrollo", async () => {
      // Reflejar cualquier Origin con credentials:true permitiría a un sitio
      // arbitrario leer respuestas autenticadas del usuario.
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "NODE_ENV") return "development";
        if (key === "CORS_ORIGINS") return "https://example.com";
        return undefined;
      });

      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback("https://other-origin.com", (err: any, allow?: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(allow).toBeUndefined();
      });
    });

    it("debería denegar localhost en producción", async () => {
      // La excepción de localhost solo vale fuera de producción.
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "NODE_ENV") return "production";
        if (key === "CORS_ORIGINS") return "https://example.com";
        return undefined;
      });

      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback("http://localhost:3000", (err: any, allow?: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(allow).toBeUndefined();
      });
    });

    it("debería permitir peticiones sin cabecera Origin", async () => {
      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback(undefined, (err: any, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
      });
    });

    it("debería denegar orígenes no permitidos en producción", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "NODE_ENV") return "production";
        if (key === "CORS_ORIGINS") return "https://example.com";
        return undefined;
      });

      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback("https://malicious.com", (err: any, allow?: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(allow).toBeUndefined();
      });
    });
  });

  describe("ValidationPipe", () => {
    it("debería configurar ValidationPipe global", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.useGlobalPipes).toHaveBeenCalledWith(
        expect.any(ValidationPipe)
      );

      const pipe = mockApp.useGlobalPipes.mock.calls[0][0];
      expect(pipe).toBeInstanceOf(ValidationPipe);
      expect(pipe).toBeDefined();
    });
  });

  describe("Global Guards", () => {
    it("debería registrar guards globales", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.useGlobalGuards).toHaveBeenCalled();
    });
  });

  describe("Global Filters", () => {
    it("debería registrar HttpExceptionFilter global", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.useGlobalFilters).toHaveBeenCalled();
    });
  });

  describe("Global Interceptors", () => {
    it("debería registrar TransformInterceptor global", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.useGlobalInterceptors).toHaveBeenCalled();
    });

    it("debería serializar la respuesta antes de envolverla", async () => {
      await createMicroserviceApp({} as any);

      // El orden importa por dos motivos: el de latencia va el primero para
      // medir todo lo que viene después, y el serializador después del que
      // envuelve, para recibir la entidad cruda y aplicar sus @Exclude().
      const registrados = mockApp.useGlobalInterceptors.mock.calls[0];
      expect(registrados.map((i: object) => i.constructor.name)).toEqual([
        "LatenciaInterceptor",
        "TransformInterceptor",
        "ClassSerializerInterceptor",
      ]);
    });
  });

  describe("Application initialization", () => {
    it("debería inicializar la aplicación", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.init).toHaveBeenCalled();
    });

    it("debería iniciar el servidor en el puerto configurado", async () => {
      const port = 3000;
      process.env.PORT = port.toString();

      await createMicroserviceApp({} as any);

      expect(mockApp.listen).toHaveBeenCalledWith(port);
    });

    it("debería usar puerto por defecto si PORT no está configurado", async () => {
      delete process.env.PORT;

      await createMicroserviceApp({} as any);

      expect(mockApp.listen).toHaveBeenCalledWith(3000);
    });
  });

  describe("ConfigService integration", () => {
    it("debería obtener ConfigService de la aplicación", async () => {
      await createMicroserviceApp({} as any);

      expect(mockApp.get).toHaveBeenCalledWith(
        require("@nestjs/config").ConfigService
      );
    });

    it("debería leer configuración CORS", async () => {
      await createMicroserviceApp({} as any);

      expect(mockConfigService.get).toHaveBeenCalledWith("CORS_ORIGINS");
    });
  });
});
