import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  TokenVersionStore,
  TOKEN_VERSION_DEFAULT,
} from "../security/token-version.store";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

import * as jwt from "jsonwebtoken";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockReflector: jest.Mocked<Reflector>;
  let mockTokenVersionStore: jest.Mocked<TokenVersionStore>;

  const mockExecutionContext = (
    url: string,
    authHeader?: string,
    user?: any
  ) => {
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url,
          headers: { authorization: authHeader },
          user,
        }),
      }),
    } as any;
    return context;
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "JWT_SECRET")
          return "test-secret-with-sufficient-length-32!!";
        return key;
      }),
    } as any;

    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockTokenVersionStore = {
      getVersion: jest.fn().mockResolvedValue(TOKEN_VERSION_DEFAULT),
      bumpVersion: jest.fn().mockResolvedValue(1),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: TokenVersionStore,
          useValue: mockTokenVersionStore,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  describe("constructor", () => {
    it("debería crear instancia correctamente", () => {
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });
  });

  describe("canActivate - endpoints públicos", () => {
    it("debería permitir acceso a rutas públicas", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext("/public/route");

      expect(await guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a /health", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = mockExecutionContext("/health");

      expect(await guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a rutas /internal", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = mockExecutionContext("/internal/test");

      expect(await guard.canActivate(context)).toBe(true);
    });
  });

  describe("canActivate - autenticación", () => {
    const validToken = "valid.jwt.token";
    const mockDecoded = {
      sub: "user-123",
      email: "test@example.com",
      role: "CLIENT",
      businessId: "business-123",
      businessIds: ["business-123", "business-456"],
      tokenVersion: TOKEN_VERSION_DEFAULT,
    };

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === "JWT_SECRET")
          return "test-secret-with-sufficient-length-32!!";
        return key;
      });
      mockTokenVersionStore.getVersion.mockResolvedValue(TOKEN_VERSION_DEFAULT);
    });

    it("debería permitir acceso con token Bearer válido", async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);

      const context = mockExecutionContext("/api/test", `Bearer ${validToken}`);

      expect(await guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest().user).toEqual({
        userId: "user-123",
        email: "test@example.com",
        role: "CLIENT",
        businessId: "business-123",
        businessIds: ["business-123", "business-456"],
      });
    });

    it("debería permitir acceso con token sin prefijo Bearer", async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);

      const context = mockExecutionContext("/api/test", validToken);

      expect(await guard.canActivate(context)).toBe(true);
    });

    it("debería lanzar UnauthorizedException cuando no hay header de autorización", async () => {
      const context = mockExecutionContext("/api/test");

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Token no proporcionado"
      );
    });

    it("debería lanzar UnauthorizedException con token inválido", async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const context = mockExecutionContext("/api/test", "Bearer invalid-token");

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Token inválido o expirado"
      );
    });

    it("debería lanzar error cuando JWT_SECRET no está configurado", async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const context = mockExecutionContext("/api/test", "Bearer token");

      await expect(guard.canActivate(context)).rejects.toThrow(
        "JWT_SECRET no está configurado"
      );
    });

    it("debería rechazar JWT_SECRET con valor por defecto débil (dev-jwt-secret-change-in-production)", async () => {
      mockConfigService.get.mockReturnValue(
        "dev-jwt-secret-change-in-production"
      );

      const context = mockExecutionContext("/api/test", "Bearer token");

      await expect(guard.canActivate(context)).rejects.toThrow(
        "tiene un valor por defecto inseguro"
      );
    });

    it("debería rechazar JWT_SECRET demasiado corto (< 16 caracteres)", async () => {
      mockConfigService.get.mockReturnValue("short");

      const context = mockExecutionContext("/api/test", "Bearer token");

      await expect(guard.canActivate(context)).rejects.toThrow(
        "es demasiado corto"
      );
    });

    it("debería extraer correctamente el token del header Bearer", async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);

      const context = mockExecutionContext("/api/test", "Bearer my-jwt-token");

      await guard.canActivate(context);

      expect(jwt.verify).toHaveBeenCalledWith(
        "my-jwt-token",
        "test-secret-with-sufficient-length-32!!",
        { algorithms: ["HS256"] }
      );
    });

    it("debería pinear el algoritmo HS256 para prevenir alg-confusion", async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);

      const context = mockExecutionContext("/api/test", "Bearer token");

      await guard.canActivate(context);

      const callArgs = (jwt.verify as jest.Mock).mock.calls.at(-1);
      expect(callArgs?.[2]).toEqual({ algorithms: ["HS256"] });
    });

    it("debería rechazar si tokenVersion no coincide (sesión invalidada)", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        ...mockDecoded,
        tokenVersion: 0,
      } as any);
      mockTokenVersionStore.getVersion.mockResolvedValue(1);

      const context = mockExecutionContext("/api/test", "Bearer token");

      await expect(guard.canActivate(context)).rejects.toThrow(
        "Sesión invalidada"
      );
    });

    it("debería permitir acceso si tokenVersion coincide con Redis", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        ...mockDecoded,
        tokenVersion: 2,
      } as any);
      mockTokenVersionStore.getVersion.mockResolvedValue(2);

      const context = mockExecutionContext("/api/test", "Bearer token");

      expect(await guard.canActivate(context)).toBe(true);
    });
  });

  describe("canActivate - integración con reflector", () => {
    it("debería leer metadatos IS_PUBLIC_KEY del handler", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext("/public/route");

      await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()]
      );
    });

    it("debería leer metadatos IS_PUBLIC_KEY de la clase si no está en el handler", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext("/public/route");

      const result = await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()]
      );
      expect(result).toBe(true);
    });
  });
});
