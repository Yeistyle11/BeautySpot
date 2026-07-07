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

describe("createAppFactory", () => {
  let NestFactoryMock: any;
  let mockApp: any;
  let mockConfigService: any;

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
      enableCors: jest.fn().mockReturnThis(),
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
    it("debería crear aplicación NestJS", async () => {
      await createMicroserviceApp({} as any);

      expect(NestFactoryMock.create).toHaveBeenCalledWith({} as any);
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

    it("debería permitir orígenes en desarrollo", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "NODE_ENV") return "development";
        if (key === "CORS_ORIGINS") return "https://example.com";
        return undefined;
      });

      await createMicroserviceApp({} as any);
      const corsCallback = mockApp.enableCors.mock.calls[0][0].origin;

      corsCallback("https://other-origin.com", (err: any, allow?: boolean) => {
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
