import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { AuthService } from "./auth.service";
import { RefreshTokenStore } from "./refresh-token.store";
import { User } from "../../entities/user.entity";
import { PasswordReset } from "../../entities/password-reset.entity";
import { EmailVerification } from "../../entities/email-verification.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@beautyspot/shared-types";
import { EventNames } from "@beautyspot/event-types";
import {
  BLOQUEO_BASE_MINUTOS,
  BLOQUEO_MAXIMO_MINUTOS,
  MAX_INTENTOS_FALLIDOS,
} from "@beautyspot/shared-constants";
import {
  EventBusService,
  TokenVersionStore,
  OutboxService,
} from "@beautyspot/nest-common";

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

describe("AuthService", () => {
  let mockTokenVersionStore: any;
  let mockRefreshTokens: any;
  let service: AuthService;
  let mockUserRepository: jest.Mocked<Repository<User>>;
  let mockPasswordResetRepository: jest.Mocked<Repository<PasswordReset>>;
  let mockEmailVerificationRepository: jest.Mocked<
    Repository<EmailVerification>
  >;
  let mockAuditLogRepository: jest.Mocked<Repository<AuditLog>>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockEventBus: jest.Mocked<EventBusService>;
  let mockOutboxService: jest.Mocked<OutboxService>;

  const mockUser: any = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    phone: "+573001234567",
    password: "hashed-password",
    active: true,
    avatar: "",
    emailVerified: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lockoutCount: 0,
    currentBusinessId: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [],
    passwordResets: [],
    generateId: () => {},
  };

  const mockPasswordReset: any = {
    id: "reset-123",
    userId: "user-123",
    tokenHash: hashResetToken("valid-token"),
    expiresAt: new Date(Date.now() + 3600000),
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    businessId: "",
    generateId: () => {},
  };

  const mockAuditLog: any = {
    id: "audit-123",
    userId: "user-123",
    action: "USER_LOGGED_IN",
    entity: "users",
    entityId: "user-123",
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    businessId: "",
    generateId: () => {},
  };

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    mockPasswordResetRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    mockEmailVerificationRepository = {
      findOne: jest.fn(),
      create: jest.fn((datos: any) => datos),
      save: jest.fn((datos: any) => Promise.resolve(datos)),
      update: jest.fn(),
    } as any;

    mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: any = {
          BCRYPT_SALT_ROUNDS: "12",
          JWT_SECRET: "test-secret-with-sufficient-length-32chars!!",
          JWT_REFRESH_SECRET: "test-refresh-secret-with-sufficient-length-32!",
          JWT_EXPIRES_IN: "15m",
          JWT_REFRESH_EXPIRES_IN: "7d",
        };
        return config[key] || key;
      }),
    } as any;

    mockEventBus = {
      emit: jest.fn(),
    } as any;

    mockOutboxService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockManager = {
      getRepository: jest.fn((target: any) => {
        if (target === User) return mockUserRepository;
        if (target === PasswordReset) return mockPasswordResetRepository;
        if (target === EmailVerification)
          return mockEmailVerificationRepository;
        return mockAuditLogRepository;
      }),
    };
    const mockDataSource: any = {
      transaction: jest.fn((cb: any) => cb(mockManager)),
    };
    mockTokenVersionStore = {
      getVersion: jest.fn().mockResolvedValue(0),
      bumpVersion: jest.fn().mockResolvedValue(1),
    };

    // Por defecto el refresh recibido está vivo: se canjea con normalidad.
    mockRefreshTokens = {
      registrar: jest.fn().mockResolvedValue(undefined),
      canjear: jest.fn().mockResolvedValue({ resultado: "válido" }),
      revocarTodos: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(PasswordReset),
          useValue: mockPasswordResetRepository,
        },
        {
          provide: getRepositoryToken(EmailVerification),
          useValue: mockEmailVerificationRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventBusService,
          useValue: mockEventBus,
        },
        { provide: "DataSource", useValue: mockDataSource },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutboxService },
        { provide: TokenVersionStore, useValue: mockTokenVersionStore },
        { provide: RefreshTokenStore, useValue: mockRefreshTokens },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("register", () => {
    it("debería registrar un nuevo usuario exitosamente", async () => {
      const registerDto = {
        email: "new@example.com",
        password: "Password123",
        name: "New User",
        phone: "+573009876543",
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      mockJwtService.sign.mockReturnValue("mock-token");
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");

      const result = await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      // El evento se encola en la misma transacción que el alta del usuario.
      expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.AUTH_USER_REGISTERED,
          payload: expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
          }),
        })
      );
      // El alta no emite tokens: la cuenta entra cuando confirma el correo.
      expect(mockJwtService.sign).not.toHaveBeenCalled();
      expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED,
          payload: expect.objectContaining({ email: mockUser.email }),
        })
      );
      expect(result).not.toHaveProperty("accessToken");
      expect(result.message).toContain("confirmar");
    });

    it("responde lo mismo cuando el correo ya tiene cuenta", async () => {
      const registerDto = {
        email: "existing@example.com",
        password: "Password123",
        name: "Existing User",
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const repetido = await service.register(registerDto);

      // Mismo cuerpo y mismo estado que un alta nueva: distinguirlos delata
      // qué correos están registrados.
      expect(repetido.message).toContain("confirmar");
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("avisa al dueño de la cuenta del alta repetida", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.register({
        email: "existing@example.com",
        password: "Password123",
        name: "Existing User",
      });

      expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.AUTH_REGISTRO_DUPLICADO,
          payload: { email: mockUser.email, name: mockUser.name },
        })
      );
      expect(mockOutboxService.enqueue).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED,
        })
      );
    });

    it("debería usar el valor BCRYPT_SALT_ROUNDS de configuración", async () => {
      const registerDto = {
        email: "new@example.com",
        password: "Password123",
        name: "New User",
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      mockJwtService.sign.mockReturnValue("mock-token");
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith("Password123", 12);
    });
  });

  describe("login", () => {
    it("debería hacer login exitosamente con credenciales correctas", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "Password123",
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        memberships: [],
      });
      mockJwtService.sign.mockReturnValue("mock-token");
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        relations: ["memberships"],
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        EventNames.AUTH_USER_LOGGED_IN,
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
        })
      );
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.user).not.toHaveProperty("password");
    });

    it("ejecuta bcrypt.compare aunque el email no exista (anti-enumeración)", async () => {
      // Un retorno temprano sin comparar hash permitiría distinguir emails
      // registrados de los que no midiendo la latencia de la respuesta.
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hash-senuelo");
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: "no-existe@example.com", password: "x" })
      ).rejects.toThrow("Credenciales inválidas");

      expect(bcrypt.compare).toHaveBeenCalledWith("x", "hash-senuelo");
    });

    it("debería lanzar UnauthorizedException con email incorrecto", async () => {
      const loginDto = {
        email: "wrong@example.com",
        password: "Password123",
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Credenciales inválidas"
      );
    });

    it("debería lanzar UnauthorizedException con contraseña incorrecta", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "WrongPassword",
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("debería lanzar UnauthorizedException para usuario desactivado", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "Password123",
      };

      const inactiveUser = { ...mockUser, active: false };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Tu cuenta ha sido desactivada"
      );
    });
  });

  describe("refreshToken", () => {
    it("nombra la cuenta desactivada al renovar, como hace el login", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
      });
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        active: false,
      });

      await expect(service.refreshToken("token-valido")).rejects.toThrow(
        "Tu cuenta ha sido desactivada"
      );
    });

    it("debería refrescar el token exitosamente", async () => {
      const payload = { sub: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("new-mock-token");

      const result = await service.refreshToken("valid-refresh-token");

      expect(mockJwtService.verify).toHaveBeenCalledWith(
        "valid-refresh-token",
        { secret: "test-refresh-secret-with-sufficient-length-32!" }
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ["memberships"],
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe("new-mock-token");
      expect(result.refreshToken).toBe("new-mock-token");
    });

    it("retira el refresh usado y emite el siguiente con otro identificador", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        jti: "jti-vivo",
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("new-mock-token");

      await service.refreshToken("valid-refresh-token");

      // Sin retirarlo, el refresh anterior seguía valiendo los siete días de su
      // vigencia en paralelo con la sesión legítima.
      expect(mockRefreshTokens.canjear).toHaveBeenCalledWith(
        mockUser.id,
        "jti-vivo"
      );
      expect(mockRefreshTokens.registrar).toHaveBeenCalledWith(
        mockUser.id,
        expect.not.stringMatching("jti-vivo")
      );
    });

    it("revoca todas las sesiones si se reutiliza un refresh ya canjeado", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        jti: "jti-ya-usado",
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockRefreshTokens.canjear.mockResolvedValue({
        resultado: "reutilizado",
      });

      await expect(service.refreshToken("token-robado")).rejects.toThrow(
        "Sesión invalidada"
      );

      // No se sabe si lo reutiliza el legítimo o quien se lo robó, así que se
      // cierran todas y se obliga a identificarse otra vez.
      expect(mockRefreshTokens.revocarTodos).toHaveBeenCalledWith(mockUser.id);
      expect(mockTokenVersionStore.bumpVersion).toHaveBeenCalledWith(
        mockUser.id
      );
    });

    it("acepta un refresh anterior a este control, que no lleva identificador", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("new-mock-token");

      // Rechazarlos cerraría la sesión de todo el mundo al desplegar.
      await expect(
        service.refreshToken("refresh-antiguo")
      ).resolves.toBeDefined();
      expect(mockRefreshTokens.canjear).not.toHaveBeenCalled();
    });

    it("sigue adelante si no se puede comprobar el refresh", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        jti: "jti-vivo",
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("new-mock-token");
      mockRefreshTokens.canjear.mockResolvedValue({
        resultado: "indeterminado",
      });

      // Cerrar la sesión de todos porque Redis no contesta sería peor que el
      // riesgo que se vigila.
      await expect(
        service.refreshToken("valid-refresh-token")
      ).resolves.toBeDefined();
      expect(mockRefreshTokens.revocarTodos).not.toHaveBeenCalled();
    });

    it("debería rechazar un refresh token emitido antes de una revocación", async () => {
      // El usuario cerró sesión o cambió su contraseña después de emitirse este
      // token: su tokenVersion quedó por detrás de la versión vigente.
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        tokenVersion: 0,
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (service as any).tokenVersionStore.getVersion.mockResolvedValue(1);

      await expect(service.refreshToken("token-revocado")).rejects.toThrow(
        "Sesión invalidada"
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it("debería rechazar un refresh token sin tokenVersion si ya hubo revocación", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (service as any).tokenVersionStore.getVersion.mockResolvedValue(2);

      await expect(service.refreshToken("token-antiguo")).rejects.toThrow(
        "Sesión invalidada"
      );
    });

    it("debería lanzar UnauthorizedException con refresh token inválido", async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        "Refresh token inválido o expirado"
      );
    });

    it("debería lanzar UnauthorizedException si el usuario no existe", async () => {
      const payload = { sub: "non-existent", email: "test@example.com" };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshToken("valid-refresh-token")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("debería lanzar UnauthorizedException si el usuario está desactivado", async () => {
      const payload = { sub: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        active: false,
      });

      await expect(service.refreshToken("valid-refresh-token")).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("forgotPassword", () => {
    it("debería generar token de reset y encolar evento via outbox", async () => {
      const email = "test@example.com";
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordResetRepository.create.mockReturnValue(mockPasswordReset);
      mockPasswordResetRepository.save.mockResolvedValue(mockPasswordReset);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.forgotPassword(email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
      expect(mockPasswordResetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        })
      );
      expect(mockPasswordResetRepository.save).toHaveBeenCalled();
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.AUTH_PASSWORD_RESET_REQUESTED,
          aggregateType: "users",
          aggregateId: mockUser.id,
          payload: expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
            resetToken: expect.any(String),
          }),
        })
      );
      expect(result.message).toBe(
        "Si el email existe, recibirás instrucciones"
      );
      expect(result).not.toHaveProperty("resetToken");
    });

    it("debería retornar mensaje sin revelar si el email existe", async () => {
      const email = "nonexistent@example.com";
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled();
      expect(result.message).toBe(
        "Si el email existe, recibirás instrucciones"
      );
    });

    it("debería establecer expiración de 1 hora", async () => {
      const email = "test@example.com";
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordResetRepository.create.mockReturnValue(mockPasswordReset);
      mockPasswordResetRepository.save.mockResolvedValue(mockPasswordReset);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      await service.forgotPassword(email);

      const createCall = mockPasswordResetRepository.create.mock.calls[0][0];
      const expiresAt = createCall.expiresAt as Date;
      const expectedExpiresAt = new Date(Date.now() + 3600000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        expectedExpiresAt.getTime() - 1000
      );
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        expectedExpiresAt.getTime() + 1000
      );
    });

    it("no debería encolar evento outbox si el usuario no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.forgotPassword("nonexistent@example.com");

      expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    const resetDto = {
      token: "valid-token",
      newPassword: "NewPassword123",
    };

    it("debería resetear el password exitosamente", async () => {
      mockPasswordResetRepository.findOne.mockResolvedValue(mockPasswordReset);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue("new-hashed-password");
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockPasswordResetRepository.update.mockResolvedValue({
        affected: 1,
      } as any);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.resetPassword(resetDto);

      expect(mockPasswordResetRepository.findOne).toHaveBeenCalledWith({
        where: { tokenHash: hashResetToken(resetDto.token) },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(resetDto.newPassword, 12);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockPasswordReset.userId,
        { password: "new-hashed-password" }
      );
      // Anula todos los tokens pendientes del usuario, no solo el consumido
      expect(mockPasswordResetRepository.update).toHaveBeenCalledWith(
        { userId: mockPasswordReset.userId, usedAt: IsNull() },
        { usedAt: expect.any(Date) }
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(result.message).toBe("Contraseña actualizada correctamente");
    });

    it("debería lanzar BadRequestException con token inválido", async () => {
      mockPasswordResetRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        "Token inválido o expirado"
      );
    });

    it("debería lanzar BadRequestException con token ya usado", async () => {
      const usedReset = { ...mockPasswordReset, usedAt: new Date() };
      mockPasswordResetRepository.findOne.mockResolvedValue(usedReset);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar BadRequestException con token expirado", async () => {
      const expiredReset = {
        ...mockPasswordReset,
        expiresAt: new Date(Date.now() - 3600000),
      };
      mockPasswordResetRepository.findOne.mockResolvedValue(expiredReset);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("changePassword", () => {
    const changePasswordDto = {
      currentPassword: "CurrentPassword123",
      newPassword: "NewPassword123",
    };

    it("debería cambiar el password exitosamente", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("new-hashed-password");
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.changePassword(
        mockUser.id,
        changePasswordDto
      );

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.password
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(
        changePasswordDto.newPassword,
        12
      );
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        password: "new-hashed-password",
      });
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(result.message).toBe("Contraseña actualizada correctamente");
    });

    it("debería lanzar NotFoundException si el usuario no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword("non-existent", changePasswordDto)
      ).rejects.toThrow(NotFoundException);
    });

    it("debería lanzar UnauthorizedException con password actual incorrecto", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, changePasswordDto)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(mockUser.id, changePasswordDto)
      ).rejects.toThrow("Contraseña actual incorrecta");
    });
  });

  describe("getMe", () => {
    it("debería retornar información del usuario sin password", async () => {
      const userWithMemberships = {
        ...mockUser,
        memberships: [
          {
            id: "membership-123",
            userId: mockUser.id,
            businessId: "business-123",
            role: Role.OWNER,
            active: true,
          } as any,
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithMemberships);

      const result = await service.getMe(mockUser.id);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ["memberships"],
      });
      expect(result).not.toHaveProperty("password");
      expect(result.memberships).toBeDefined();
    });

    it("debería lanzar NotFoundException si el usuario no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("validateUser", () => {
    it("debería validar usuario exitosamente", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await (service as any).validateUser(
        mockUser.email,
        "Password123"
      );

      expect(result).toEqual(mockUser);
    });

    it("debería lanzar UnauthorizedException si el usuario no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        (service as any).validateUser("nonexistent@example.com", "password")
      ).rejects.toThrow(UnauthorizedException);
    });

    it("debería lanzar UnauthorizedException si el password es incorrecto", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        (service as any).validateUser(mockUser.email, "wrong-password")
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("generateTokens", () => {
    it("debería generar access y refresh tokens", async () => {
      mockJwtService.sign.mockReturnValue("mock-token");

      const result = await (service as any).generateTokens(mockUser);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: Role.CLIENT,
        }),
        {
          secret: "test-secret-with-sufficient-length-32chars!!",
          expiresIn: "15m",
        }
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          tokenVersion: 0,
          // Cada refresh sale identificado, para poder retirarlo al canjearlo.
          jti: expect.any(String),
        }),
        {
          secret: "test-refresh-secret-with-sufficient-length-32!",
          expiresIn: "7d",
        }
      );
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("debería incluir rol y businessId del usuario en access token", async () => {
      const userWithMembership = {
        ...mockUser,
        memberships: [
          {
            role: Role.OWNER,
            businessId: "business-123",
            active: true,
          } as any,
        ],
      };
      mockJwtService.sign.mockReturnValue("mock-token");

      await (service as any).generateTokens(userWithMembership);

      const payload = mockJwtService.sign.mock.calls[0][0] as any;
      expect(payload.role).toBe(Role.OWNER);
      expect(payload.businessId).toBe("business-123");
    });

    it("debería usar rol CLIENT cuando membresía activa no tiene rol o businessId", async () => {
      const userWithInvalidMembership = {
        ...mockUser,
        memberships: [
          {
            role: null as any,
            businessId: null as any,
            active: true,
          } as any,
        ],
      };
      mockJwtService.sign.mockReturnValue("mock-token");

      await (service as any).generateTokens(userWithInvalidMembership);

      const payload = mockJwtService.sign.mock.calls[0][0] as any;
      expect(payload.role).toBe(Role.CLIENT);
      expect(payload.businessId).toBeUndefined();
    });
  });

  describe("logAction", () => {
    it("debería crear y guardar log de auditoría", async () => {
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      await (service as any).logAction(
        mockUser.id,
        "USER_LOGGED_IN",
        "users",
        mockUser.id
      );

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        action: "USER_LOGGED_IN",
        entity: "users",
        entityId: mockUser.id,
      });
      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });
  });

  describe("verifyEmail", () => {
    const verificacion = {
      id: "verif-123",
      userId: mockUser.id,
      tokenHash: hashResetToken("token-bueno"),
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    };

    it("marca el correo como verificado y gasta el token", async () => {
      mockEmailVerificationRepository.findOne.mockResolvedValue(
        verificacion as any
      );
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.verifyEmail("token-bueno");

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        emailVerified: true,
      });
      expect(mockEmailVerificationRepository.update).toHaveBeenCalledWith(
        verificacion.id,
        expect.objectContaining({ usedAt: expect.any(Date) })
      );
      expect(result.message).toContain("Correo confirmado");
    });

    it("rechaza un token desconocido", async () => {
      mockEmailVerificationRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail("token-malo")).rejects.toThrow(
        BadRequestException
      );
    });

    it("rechaza un token ya gastado", async () => {
      mockEmailVerificationRepository.findOne.mockResolvedValue({
        ...verificacion,
        usedAt: new Date(),
      } as any);

      await expect(service.verifyEmail("token-bueno")).rejects.toThrow(
        BadRequestException
      );
    });

    it("rechaza un token vencido", async () => {
      mockEmailVerificationRepository.findOne.mockResolvedValue({
        ...verificacion,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(service.verifyEmail("token-bueno")).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("resendVerification", () => {
    it("emite otro enlace si la cuenta existe y falta confirmarla", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });

      const result = await service.resendVerification(mockUser.email);

      expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED,
        })
      );
      expect(result.message).toContain("Si la cuenta existe");
    });

    it("responde lo mismo sin emitir nada si la cuenta no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.resendVerification("nadie@example.com");

      expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
      expect(result.message).toContain("Si la cuenta existe");
    });

    it("no reenvía nada a una cuenta ya confirmada", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.resendVerification(mockUser.email);

      expect(mockOutboxService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("bloqueo por intentos fallidos", () => {
    const validar = (usuario: any) =>
      (service as any).validateUser(usuario.email, "Password123");

    it("suma el fallo sin bloquear mientras no llegue al máximo", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(validar(mockUser)).rejects.toThrow(UnauthorizedException);

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        failedLoginAttempts: 2,
      });
    });

    it("bloquea al llegar al máximo, con la espera base el primer bloqueo", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: MAX_INTENTOS_FALLIDOS - 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const antes = Date.now();
      await expect(validar(mockUser)).rejects.toThrow(UnauthorizedException);

      const cambios = mockUserRepository.update.mock.calls[0][1] as any;
      expect(cambios.lockoutCount).toBe(1);
      expect(cambios.lockedUntil.getTime() - antes).toBeGreaterThanOrEqual(
        BLOQUEO_BASE_MINUTOS * 60000 - 1000
      );
    });

    it("dobla la espera en cada bloqueo encadenado, hasta el tope", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: MAX_INTENTOS_FALLIDOS - 1,
        lockoutCount: 99,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const antes = Date.now();
      await expect(validar(mockUser)).rejects.toThrow(UnauthorizedException);

      const cambios = mockUserRepository.update.mock.calls[0][1] as any;
      expect(cambios.lockedUntil.getTime() - antes).toBeLessThanOrEqual(
        BLOQUEO_MAXIMO_MINUTOS * 60000 + 1000
      );
    });

    it("rechaza el intento mientras el bloqueo sigue vigente", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 5 * 60000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(validar(mockUser)).rejects.toThrow("Cuenta bloqueada");
    });

    it("no le dice a quien falla la contraseña que la cuenta está bloqueada", async () => {
      // El mensaje de bloqueo revela que ese correo tiene cuenta, así que solo
      // lo ve quien ya ha demostrado conocer la contraseña.
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 5 * 60000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(validar(mockUser)).rejects.toThrow("Credenciales inválidas");
    });

    it("no alarga el bloqueo con los intentos de quien prueba a ciegas", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: MAX_INTENTOS_FALLIDOS - 1,
        lockedUntil: new Date(Date.now() + 5 * 60000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(validar(mockUser)).rejects.toThrow("Credenciales inválidas");

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it("limpia los fallos tras un acceso correcto", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 3,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await validar(mockUser);

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        failedLoginAttempts: 0,
        lockoutCount: 0,
        lockedUntil: null,
      });
    });

    it("no deja entrar a una cuenta sin confirmar", async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(validar(mockUser)).rejects.toThrow("Confirma tu correo");
    });
  });
});
