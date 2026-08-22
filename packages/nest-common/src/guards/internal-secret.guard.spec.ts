import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InternalSecretGuard } from "./internal-secret.guard";
import { IS_INTERNAL_KEY } from "../decorators/internal.decorator";

describe("InternalSecretGuard", () => {
  let guard: InternalSecretGuard;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockExecutionContext = (
    url: string,
    secretHeader?: string,
    marcadoInterno = false
  ) => {
    const handler = marcadoInterno ? manejadorInterno : manejadorCorriente;
    const context = {
      getType: jest.fn().mockReturnValue("http"),
      getHandler: jest.fn().mockReturnValue(handler),
      getClass: jest.fn().mockReturnValue(class {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url,
          headers: { "x-internal-secret": secretHeader },
        }),
      }),
    } as any;
    return context;
  };

  /** Manejador con la marca que deja el decorador @Internal(). */
  function manejadorInterno() {}
  Reflect.defineMetadata(IS_INTERNAL_KEY, true, manejadorInterno);

  function manejadorCorriente() {}

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "INTERNAL_API_SECRET") return "internal-secret-123";
        return key;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalSecretGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        Reflector,
      ],
    }).compile();

    guard = module.get<InternalSecretGuard>(InternalSecretGuard);
  });

  describe("constructor", () => {
    it("debería crear instancia correctamente", () => {
      expect(guard).toBeInstanceOf(InternalSecretGuard);
    });
  });

  describe("canActivate", () => {
    it("exige el secreto en un controlador marcado @Internal(), cuelgue donde cuelgue", () => {
      // Renombrar la ruta no puede desproteger el endpoint.
      const context = mockExecutionContext("/usuarios/sync", undefined, true);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("acepta el secreto correcto en un controlador marcado @Internal()", () => {
      const context = mockExecutionContext(
        "/usuarios/sync",
        "internal-secret-123",
        true
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a rutas que no son /internal", () => {
      const context = mockExecutionContext("/api/public");

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a rutas /internal con secret correcto", () => {
      const context = mockExecutionContext(
        "/internal/test",
        "internal-secret-123"
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería lanzar ForbiddenException cuando no hay header x-internal-secret", () => {
      const context = mockExecutionContext("/internal/test");

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "Acceso denegado al endpoint interno"
      );
    });

    it("debería lanzar ForbiddenException con secret incorrecto", () => {
      const context = mockExecutionContext("/internal/test", "wrong-secret");

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("debería lanzar ForbiddenException cuando secret no coincide", () => {
      const context = mockExecutionContext("/internal/test", "another-secret");

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("debería denegar acceso cuando INTERNAL_API_SECRET no está configurado", () => {
      mockConfigService.get.mockReturnValue(undefined);

      const context = mockExecutionContext("/internal/test", "some-secret");

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("debería permitir acceso con vacío cuando INTERNAL_API_SECRET no está configurado y no es ruta interna", () => {
      mockConfigService.get.mockReturnValue(undefined);

      const context = mockExecutionContext("/api/test", "some-secret");

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería verificar secret exacto (case-sensitive)", () => {
      const context = mockExecutionContext(
        "/internal/test",
        "Internal-Secret-123"
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
