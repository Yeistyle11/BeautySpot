import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

import * as jwt from 'jsonwebtoken';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockReflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (url: string, authHeader?: string, user?: any) => {
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
        if (key === 'JWT_SECRET') return 'test-secret';
        return key;
      }),
    } as any;

    mockReflector = {
      getAllAndOverride: jest.fn(),
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
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  describe('constructor', () => {
    it('debería crear instancia correctamente', () => {
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });
  });

  describe('canActivate - endpoints públicos', () => {
    it('debería permitir acceso a rutas públicas', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext('/public/route');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('debería permitir acceso a /health', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = mockExecutionContext('/health');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('debería permitir acceso a rutas /internal', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = mockExecutionContext('/internal/test');

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('canActivate - autenticación', () => {
    const validToken = 'valid.jwt.token';
    const mockDecoded = {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'CLIENT',
      businessId: 'business-123',
      businessIds: ['business-123', 'business-456'],
    };

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return key;
      });
    });

    it('debería permitir acceso con token Bearer válido', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);
      
      const context = mockExecutionContext(
        '/api/test',
        `Bearer ${validToken}`
      );

      expect(guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest().user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CLIENT',
        businessId: 'business-123',
        businessIds: ['business-123', 'business-456'],
      });
    });

    it('debería permitir acceso con token sin prefijo Bearer', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);
      
      const context = mockExecutionContext('/api/test', validToken);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('debería lanzar UnauthorizedException cuando no hay header de autorización', () => {
      const context = mockExecutionContext('/api/test');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Token no proporcionado');
    });

    it('debería lanzar UnauthorizedException con token inválido', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const context = mockExecutionContext('/api/test', 'Bearer invalid-token');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Token inválido o expirado');
    });

    it('debería lanzar Error cuando JWT_SECRET no está configurado', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const context = mockExecutionContext('/api/test', 'Bearer token');

      expect(() => guard.canActivate(context)).toThrow('JWT_SECRET no está configurado');
    });

    it('debería extraer correctamente el token del header Bearer', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded as any);
      
      const context = mockExecutionContext('/api/test', 'Bearer my-jwt-token');

      guard.canActivate(context);

      expect(jwt.verify).toHaveBeenCalledWith('my-jwt-token', 'test-secret');
    });
  });

  describe('canActivate - integración con reflector', () => {
    it('debería leer metadatos IS_PUBLIC_KEY del handler', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext('/public/route');

      guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()]
      );
    });

    it('debería leer metadatos IS_PUBLIC_KEY de la clase si no está en el handler', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = mockExecutionContext('/public/route');

      const result = guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()]
      );
      expect(result).toBe(true);
    });
  });
});