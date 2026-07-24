import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ForbiddenException } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";
import { Role } from "@beautyspot/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let mockReflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (
    user?: any,
    _handlerRoles?: Role[],
    _classRoles?: Role[]
  ) => {
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
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
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  describe("constructor", () => {
    it("debería crear instancia correctamente", () => {
      expect(guard).toBeInstanceOf(RolesGuard);
    });
  });

  describe("canActivate", () => {
    it("debería permitir acceso cuando no hay roles requeridos", () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);

      const context = mockExecutionContext({ role: Role.CLIENT });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso cuando roles requeridos es undefined", () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const context = mockExecutionContext({ role: Role.CLIENT });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso a SUPER_ADMIN sin importar roles requeridos", () => {
      const requiredRoles = [Role.OWNER];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext({ role: Role.SUPER_ADMIN });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería permitir acceso cuando el rol del usuario coincide con roles requeridos", () => {
      const requiredRoles = [Role.OWNER, Role.ADMIN];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext({ role: Role.OWNER });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería denegar acceso cuando el rol del usuario no está en roles requeridos", () => {
      const requiredRoles = [Role.OWNER, Role.ADMIN];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext({ role: Role.CLIENT });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        "No tienes permisos para realizar esta acción"
      );
    });

    it("debería lanzar ForbiddenException cuando no hay usuario en el request", () => {
      const requiredRoles = [Role.OWNER];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("debería leer roles desde el handler cuando están definidos", () => {
      const handlerRoles = [Role.ADMIN];
      mockReflector.getAllAndOverride.mockReturnValue(handlerRoles);

      const context = mockExecutionContext({ role: Role.ADMIN });

      guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it("debería permitir acceso con rol PROFESSIONAL cuando es requerido", () => {
      const requiredRoles = [Role.PROFESSIONAL];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext({ role: Role.PROFESSIONAL });

      expect(guard.canActivate(context)).toBe(true);
    });

    it("debería denegar acceso a CLIENT cuando se requiere OWNER", () => {
      const requiredRoles = [Role.OWNER];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext({ role: Role.CLIENT });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("debería permitir acceso con múltiples roles requeridos si el usuario tiene uno", () => {
      const requiredRoles = [Role.OWNER, Role.ADMIN, Role.PROFESSIONAL];
      mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);

      const context = mockExecutionContext({ role: Role.ADMIN });

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
