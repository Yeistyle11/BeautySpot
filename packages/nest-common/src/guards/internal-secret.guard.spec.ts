import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { InternalSecretGuard } from './internal-secret.guard';

describe('InternalSecretGuard', () => {
  let guard: InternalSecretGuard;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockExecutionContext = (url: string, secretHeader?: string) => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url,
          headers: { 'x-internal-secret': secretHeader },
        }),
      }),
    } as any;
    return context;
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return 'internal-secret-123';
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
      ],
    }).compile();

    guard = module.get<InternalSecretGuard>(InternalSecretGuard);
  });

  describe('constructor', () => {
    it('debería crear instancia correctamente', () => {
      expect(guard).toBeInstanceOf(InternalSecretGuard);
    });
  });

  describe('canActivate', () => {
    it('debería permitir acceso a rutas que no son /internal', () => {
      const context = mockExecutionContext('/api/public');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('debería permitir acceso a rutas /internal con secret correcto', () => {
      const context = mockExecutionContext(
        '/internal/test',
        'internal-secret-123'
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it('debería lanzar ForbiddenException cuando no hay header x-internal-secret', () => {
      const context = mockExecutionContext('/internal/test');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Acceso denegado al endpoint interno');
    });

    it('debería lanzar ForbiddenException con secret incorrecto', () => {
      const context = mockExecutionContext(
        '/internal/test',
        'wrong-secret'
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debería lanzar ForbiddenException cuando secret no coincide', () => {
      const context = mockExecutionContext(
        '/internal/test',
        'another-secret'
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debería denegar acceso cuando INTERNAL_API_SECRET no está configurado', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const context = mockExecutionContext(
        '/internal/test',
        'some-secret'
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debería permitir acceso con vacío cuando INTERNAL_API_SECRET no está configurado y no es ruta interna', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const context = mockExecutionContext('/api/test', 'some-secret');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('debería verificar secret exacto (case-sensitive)', () => {
      const context = mockExecutionContext(
        '/internal/test',
        'Internal-Secret-123'
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});