import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { User } from '../../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    phone: '+573001234567',
    avatar: '',
    emailVerified: false,
    active: true,
    currentBusinessId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [],
    passwordResets: [],
    generateId: () => 'mock-id',
  };

  const mockAuthResponse = {
    user: mockUser,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      getMe: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('constructor', () => {
    it('debería crear instancia correctamente', () => {
      expect(controller).toBeInstanceOf(AuthController);
    });
  });

  describe('register', () => {
    it('debería registrar usuario exitosamente', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'Password123',
        name: 'New User',
        phone: '+573009876543',
      };

      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto as any);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('debería lanzar error cuando el email ya existe', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123',
        name: 'Existing User',
      };

      mockAuthService.register.mockRejectedValue(
        new BadRequestException('El email ya está registrado')
      );

      await expect(controller.register(registerDto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('debería hacer login exitosamente', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123',
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('debería lanzar UnauthorizedException con credenciales incorrectas', async () => {
      const loginDto = {
        email: 'wrong@example.com',
        password: 'WrongPassword',
      };

      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciales inválidas')
      );

      await expect(controller.login(loginDto as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('debería refrescar token exitosamente', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshToken.mockResolvedValue(newTokens);

      const result = await controller.refreshToken('valid-refresh-token');

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(result).toEqual(newTokens);
    });

    it('debería lanzar UnauthorizedException con refresh token inválido', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Refresh token inválido o expirado')
      );

      await expect(controller.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('debería enviar email de recuperación exitosamente', async () => {
      const response = { message: 'Si el email existe, recibirás instrucciones' };

      mockAuthService.forgotPassword.mockResolvedValue(response);

      const result = await controller.forgotPassword({ email: 'test@example.com' } as any);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(response);
    });
  });

  describe('resetPassword', () => {
    it('debería resetear contraseña exitosamente', async () => {
      const response = { message: 'Contraseña actualizada correctamente' };

      mockAuthService.resetPassword.mockResolvedValue(response);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123',
      } as any);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'NewPassword123',
      });
      expect(result).toEqual(response);
    });

    it('debería lanzar BadRequestException con token inválido', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Token inválido o expirado')
      );

      await expect(
        controller.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('debería cambiar contraseña exitosamente', async () => {
      const response = { message: 'Contraseña actualizada correctamente' };

      mockAuthService.changePassword.mockResolvedValue(response);

      const result = await controller.changePassword(
        'user-123',
        {
          currentPassword: 'CurrentPassword123',
          newPassword: 'NewPassword123',
        } as any
      );

      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-123', {
        currentPassword: 'CurrentPassword123',
        newPassword: 'NewPassword123',
      });
      expect(result).toEqual(response);
    });
  });

  describe('getMe', () => {
    it('debería retornar información del usuario', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockAuthService.getMe.mockResolvedValue(user);

      const result = await controller.getMe('user-123');

      expect(mockAuthService.getMe).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(user);
    });
  });
});