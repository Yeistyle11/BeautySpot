import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@beautyspot/shared-types';
import { EventNames } from '@beautyspot/event-types';
import { EventBusService } from '@beautyspot/nest-common';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepository: jest.Mocked<Repository<User>>;
  let mockPasswordResetRepository: jest.Mocked<Repository<PasswordReset>>;
  let mockAuditLogRepository: jest.Mocked<Repository<AuditLog>>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockEventBus: jest.Mocked<EventBusService>;

  const mockUser: any = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    phone: '+573001234567',
    password: 'hashed-password',
    active: true,
    avatar: '',
    emailVerified: false,
    currentBusinessId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [],
    passwordResets: [],
    generateId: () => {},
  };

  const mockPasswordReset: any = {
    id: 'reset-123',
    userId: 'user-123',
    token: 'reset-token',
    expiresAt: new Date(Date.now() + 3600000),
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    businessId: '',
    generateId: () => {},
  };

  const mockAuditLog: any = {
    id: 'audit-123',
    userId: 'user-123',
    action: 'USER_LOGGED_IN',
    entity: 'users',
    entityId: 'user-123',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    businessId: '',
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
          BCRYPT_SALT_ROUNDS: '12',
          JWT_SECRET: 'test-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return config[key] || key;
      }),
    } as any;

    mockEventBus = {
      emit: jest.fn(),
    } as any;

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('debería registrar un nuevo usuario exitosamente', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'Password123',
        name: 'New User',
        phone: '+573009876543',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      mockJwtService.sign.mockReturnValue('mock-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        EventNames.AUTH_USER_REGISTERED,
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        }),
      );
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.user).not.toHaveProperty('password');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('debería lanzar ConflictException si el email ya existe', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123',
        name: 'Existing User',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'El email ya está registrado'
      );
    });

    it('debería usar el valor BCRYPT_SALT_ROUNDS de configuración', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'Password123',
        name: 'New User',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      mockJwtService.sign.mockReturnValue('mock-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 12);
    });
  });

  describe('login', () => {
    it('debería hacer login exitosamente con credenciales correctas', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        memberships: [],
      });
      mockJwtService.sign.mockReturnValue('mock-token');
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        EventNames.AUTH_USER_LOGGED_IN,
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
        }),
      );
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.user).not.toHaveProperty('password');
    });

    it('debería lanzar UnauthorizedException con email incorrecto', async () => {
      const loginDto = {
        email: 'wrong@example.com',
        password: 'Password123',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Credenciales inválidas'
      );
    });

    it('debería lanzar UnauthorizedException con contraseña incorrecta', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('debería lanzar UnauthorizedException para usuario desactivado', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const inactiveUser = { ...mockUser, active: false };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Cuenta desactivada'
      );
    });
  });

  describe('refreshToken', () => {
    it('debería refrescar el token exitosamente', async () => {
      const payload = { sub: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-mock-token');

      const result = await service.refreshToken('valid-refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith(
        'valid-refresh-token',
        { secret: 'test-refresh-secret' }
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['memberships'],
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('new-mock-token');
      expect(result.refreshToken).toBe('new-mock-token');
    });

    it('debería lanzar UnauthorizedException con refresh token inválido', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        'Refresh token inválido o expirado'
      );
    });

    it('debería lanzar UnauthorizedException si el usuario no existe', async () => {
      const payload = { sub: 'non-existent', email: 'test@example.com' };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('debería lanzar UnauthorizedException si el usuario está desactivado', async () => {
      const payload = { sub: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, active: false });

      await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('forgotPassword', () => {
    it('debería generar token de reset para usuario existente', async () => {
      const email = 'test@example.com';
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordResetRepository.create.mockReturnValue(mockPasswordReset);
      mockPasswordResetRepository.save.mockResolvedValue(mockPasswordReset);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      (uuidv4 as jest.Mock).mockReturnValue('new-reset-token');

      const result = await service.forgotPassword(email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
      expect(uuidv4).toHaveBeenCalled();
      expect(mockPasswordResetRepository.create).toHaveBeenCalled();
      expect(mockPasswordResetRepository.save).toHaveBeenCalled();
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(result.message).toBe('Si el email existe, recibirás instrucciones');
    });

    it('debería retornar mensaje sin revelar si el email existe', async () => {
      const email = 'nonexistent@example.com';
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
      expect(mockPasswordResetRepository.create).not.toHaveBeenCalled();
      expect(result.message).toBe('Si el email existe, recibirás instrucciones');
    });

    it('debería establecer expiración de 1 hora', async () => {
      const email = 'test@example.com';
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordResetRepository.create.mockReturnValue(mockPasswordReset);
      mockPasswordResetRepository.save.mockResolvedValue(mockPasswordReset);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);
      (uuidv4 as jest.Mock).mockReturnValue('new-reset-token');

      await service.forgotPassword(email);

      const createCall = mockPasswordResetRepository.create.mock.calls[0][0];
      const expiresAt = createCall.expiresAt as Date;
      const expectedExpiresAt = new Date(Date.now() + 3600000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiresAt.getTime() - 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiresAt.getTime() + 1000);
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      token: 'valid-token',
      newPassword: 'NewPassword123',
    };

    it('debería resetear el password exitosamente', async () => {
      mockPasswordResetRepository.findOne.mockResolvedValue(mockPasswordReset);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockPasswordResetRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.resetPassword(resetDto);

      expect(mockPasswordResetRepository.findOne).toHaveBeenCalledWith({
        where: { token: resetDto.token },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(resetDto.newPassword, 12);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockPasswordReset.userId,
        { password: 'new-hashed-password' }
      );
      expect(mockPasswordResetRepository.update).toHaveBeenCalledWith(
        mockPasswordReset.id,
        { usedAt: expect.any(Date) }
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(result.message).toBe('Contraseña actualizada correctamente');
    });

    it('debería lanzar BadRequestException con token inválido', async () => {
      mockPasswordResetRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        'Token inválido o expirado'
      );
    });

    it('debería lanzar BadRequestException con token ya usado', async () => {
      const usedReset = { ...mockPasswordReset, usedAt: new Date() };
      mockPasswordResetRepository.findOne.mockResolvedValue(usedReset);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('debería lanzar BadRequestException con token expirado', async () => {
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

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'CurrentPassword123',
      newPassword: 'NewPassword123',
    };

    it('debería cambiar el password exitosamente', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.changePassword(mockUser.id, changePasswordDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.password
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(changePasswordDto.newPassword, 12);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        { password: 'new-hashed-password' }
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalled();
      expect(result.message).toBe('Contraseña actualizada correctamente');
    });

    it('debería lanzar NotFoundException si el usuario no existe', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('non-existent', changePasswordDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar UnauthorizedException con password actual incorrecto', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, changePasswordDto)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(mockUser.id, changePasswordDto)
      ).rejects.toThrow('Contraseña actual incorrecta');
    });
  });

  describe('getMe', () => {
    it('debería retornar información del usuario sin password', async () => {
      const userWithMemberships = {
        ...mockUser,
        memberships: [
          {
            id: 'membership-123',
            userId: mockUser.id,
            businessId: 'business-123',
            role: Role.OWNER,
            active: true,
          } as any,
        ],
      };
      mockUserRepository.findOne.mockResolvedValue(userWithMemberships);

      const result = await service.getMe(mockUser.id);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['memberships'],
      });
      expect(result).not.toHaveProperty('password');
      expect(result.memberships).toBeDefined();
    });

    it('debería lanzar NotFoundException si el usuario no existe', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe('non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('validateUser', () => {
    it('debería validar usuario exitosamente', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await (service as any).validateUser(
        mockUser.email,
        'Password123'
      );

      expect(result).toEqual(mockUser);
    });

    it('debería lanzar UnauthorizedException si el usuario no existe', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        (service as any).validateUser('nonexistent@example.com', 'password')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si el password es incorrecto', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        (service as any).validateUser(mockUser.email, 'wrong-password')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateTokens', () => {
    it('debería generar access y refresh tokens', async () => {
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await (service as any).generateTokens(mockUser);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: Role.CLIENT,
        }),
        { secret: 'test-secret', expiresIn: '15m' }
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, email: mockUser.email },
        { secret: 'test-refresh-secret', expiresIn: '7d' }
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('debería incluir rol y businessId del usuario en access token', async () => {
      const userWithMembership = {
        ...mockUser,
        memberships: [
          {
            role: Role.OWNER,
            businessId: 'business-123',
            active: true,
          } as any,
        ],
      };
      mockJwtService.sign.mockReturnValue('mock-token');

      await (service as any).generateTokens(userWithMembership);

      const payload = mockJwtService.sign.mock.calls[0][0] as any;
      expect(payload.role).toBe(Role.OWNER);
      expect(payload.businessId).toBe('business-123');
    });

    it('debería usar rol CLIENT cuando membresía activa no tiene rol o businessId', async () => {
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
      mockJwtService.sign.mockReturnValue('mock-token');

      await (service as any).generateTokens(userWithInvalidMembership);

      const payload = mockJwtService.sign.mock.calls[0][0] as any;
      expect(payload.role).toBe(Role.CLIENT);
      expect(payload.businessId).toBeUndefined();
    });
  });

  describe('logAction', () => {
    it('debería crear y guardar log de auditoría', async () => {
      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      await (service as any).logAction(
        mockUser.id,
        'USER_LOGGED_IN',
        'users',
        mockUser.id
      );

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        action: 'USER_LOGGED_IN',
        entity: 'users',
        entityId: mockUser.id,
      });
      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });
  });
});