import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BusinessScopeGuard } from "./business-scope.guard";
import { Role } from "@beautyspot/shared-types";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

describe("BusinessScopeGuard", () => {
  let guard: BusinessScopeGuard;
  let mockReflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (
    url: string,
    businessId?: string,
    user?: any
  ) => {
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url,
          headers: { "x-business-id": businessId },
          user,
        }),
      }),
    } as any;
    return context;
  };

  beforeEach(async () => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessScopeGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<BusinessScopeGuard>(BusinessScopeGuard);
  });

  describe("constructor", () => {
    it("debería crear instancia correctamente", () => {
      expect(guard).toBeInstanceOf(BusinessScopeGuard);
    });
  });

  describe("canActivate - rutas públicas y especiales", () => {
    it("debería permitir acceso a rutas públicas", () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext("/public/route");

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a /health", () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = mockExecutionContext("/health");

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a /internal", () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = mockExecutionContext("/internal/test");

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("canActivate - validación de businessId", () => {
    it("debería lanzar BadRequestException cuando no hay header X-Business-Id", () => {
      const context = mockExecutionContext("/api/test");

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
      expect(() => guard.canActivate(context)).toThrow(
        "Header X-Business-Id es requerido"
      );
    });

    it("debería lanzar BadRequestException con businessId inválido", () => {
      const context = mockExecutionContext("/api/test", "invalid-uuid");

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
      expect(() => guard.canActivate(context)).toThrow(
        "Header X-Business-Id debe ser un UUID válido"
      );
    });

    it("debería aceptar UUID válido", () => {
      const validBusinessId = "550e8400-e29b-41d4-a716-446655440000";
      const context = mockExecutionContext("/api/test", validBusinessId);

      expect(() => guard.canActivate(context)).not.toThrow();
    });

    it("debería asignar businessId al request", () => {
      const validBusinessId = "550e8400-e29b-41d4-a716-446655440000";
      const context = mockExecutionContext("/api/test", validBusinessId);

      guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.businessId).toBe(validBusinessId);
    });
  });

  describe("canActivate - autorización de usuarios", () => {
    const validBusinessId = "550e8400-e29b-41d4-a716-446655440000";

    it("debería permitir acceso a SUPER_ADMIN a cualquier negocio", () => {
      const user = {
        id: "user-123",
        role: Role.SUPER_ADMIN,
        businessIds: ["other-business"],
      };

      const context = mockExecutionContext("/api/test", validBusinessId, user);

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso cuando usuario tiene el businessId en businessIds", () => {
      const user = {
        id: "user-123",
        role: Role.OWNER,
        businessIds: [validBusinessId, "other-business"],
      };

      const context = mockExecutionContext("/api/test", validBusinessId, user);

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso cuando usuario tiene businessId individual", () => {
      const user = {
        id: "user-123",
        role: Role.OWNER,
        businessId: validBusinessId,
      };

      const context = mockExecutionContext("/api/test", validBusinessId, user);

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería denegar acceso cuando usuario no tiene el businessId", () => {
      const user = {
        id: "user-123",
        role: Role.OWNER,
        businessIds: ["other-business-1", "other-business-2"],
      };

      const context = mockExecutionContext("/api/test", validBusinessId, user);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "No tienes acceso a este negocio"
      );
    });

    it("debería denegar acceso cuando usuario tiene businessId diferente", () => {
      const user = {
        id: "user-123",
        role: Role.OWNER,
        businessId: "other-business-123",
      };

      const context = mockExecutionContext("/api/test", validBusinessId, user);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("debería permitir acceso sin usuario (para endpoints anónimos)", () => {
      const context = mockExecutionContext("/api/test", validBusinessId);

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería manejar businessIds vacío correctamente", () => {
      const user = {
        id: "user-123",
        role: Role.CLIENT,
        businessIds: [],
      };

      const context = mockExecutionContext("/api/test", validBusinessId, user);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe("canActivate - integración con reflector", () => {
    it("debería leer metadatos IS_PUBLIC_KEY del handler", () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext("/public/route");

      guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()]
      );
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
