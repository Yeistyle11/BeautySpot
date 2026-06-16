import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

// Mock de ioredis local para este test
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockRedisInstance),
  };
});

describe('TenantService', () => {
  let service: TenantService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockRedisInstance.get.mockResolvedValue(null);
    mockRedisInstance.set.mockResolvedValue('OK');
    mockRedisInstance.del.mockResolvedValue(1);

    // Mock global fetch
    global.fetch = jest.fn() as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  describe('resolveFromSubdomain', () => {
    it('debería retornar null si el host no incluye el dominio', async () => {
      mockConfigService.get.mockReturnValue('beautyspot.co');

      const result = await service.resolveFromSubdomain('external.com');

      expect(result).toBeNull();
    });

    it('debería retornar null si el subdominio es www', async () => {
      mockConfigService.get.mockReturnValue('beautyspot.co');

      const result = await service.resolveFromSubdomain('www.beautyspot.co');

      expect(result).toBeNull();
    });

    it('debería retornar null si el subdominio es api', async () => {
      mockConfigService.get.mockReturnValue('beautyspot.co');

      const result = await service.resolveFromSubdomain('api.beautyspot.co');

      expect(result).toBeNull();
    });

    it('debería extraer el subdominio y llamar a resolveSlug', async () => {
      mockConfigService.get.mockReturnValue('beautyspot.co');
      const expectedBusinessId = 'business-123';
      mockRedisInstance.get.mockResolvedValue(expectedBusinessId);

      const result = await service.resolveFromSubdomain('mystudio.beautyspot.co');

      expect(result).toBe(expectedBusinessId);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('tenant:mystudio');
    });

    it('debería manejar hosts complejos con puertos', async () => {
      mockConfigService.get.mockReturnValue('beautyspot.co');
      const expectedBusinessId = 'business-456';
      mockRedisInstance.get.mockResolvedValue(expectedBusinessId);

      const result = await service.resolveFromSubdomain('mystudio.beautyspot.co:3000');

      expect(result).toBe(expectedBusinessId);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('tenant:mystudio');
    });
  });

  describe('resolveSlug', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'APP_DOMAIN') return 'beautyspot.co';
        if (key === 'CORE_SERVICE_URL') return 'http://localhost:3002';
        if (key === 'INTERNAL_API_SECRET') return 'secret123';
        return undefined;
      });
    });

    it('debería retornar businessId desde caché si existe', async () => {
      const slug = 'mystudio';
      const cachedBusinessId = 'business-123';
      
      mockRedisInstance.get.mockResolvedValue(cachedBusinessId);

      const result = await service.resolveSlug(slug);

      expect(result).toBe(cachedBusinessId);
      expect(mockRedisInstance.get).toHaveBeenCalledWith(`tenant:${slug}`);
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('debería hacer fetch al core service si no está en caché', async () => {
      const slug = 'mystudio';
      const businessId = 'business-456';
      const responseBody = { data: { id: businessId } };

      mockRedisInstance.get.mockResolvedValue(null);
      
      // Mock global fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => responseBody,
      } as Response);

      const result = await service.resolveSlug(slug);

      expect(result).toBe(businessId);
      expect(mockRedisInstance.get).toHaveBeenCalledWith(`tenant:${slug}`);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/internal/businesses/resolve?slug=${encodeURIComponent(slug)}`,
        expect.objectContaining({
          headers: { "x-internal-secret": "secret123" }
        })
      );
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        `tenant:${slug}`,
        businessId,
        "EX",
        300
      );
    });

    it('debería lanzar NotFoundException si el core service retorna 404', async () => {
      const slug = 'nonexistent';

      mockRedisInstance.get.mockResolvedValue(null);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(service.resolveSlug(slug)).rejects.toThrow(NotFoundException);
      await expect(service.resolveSlug(slug)).rejects.toThrow(`Negocio "${slug}" no encontrado`);
    });

    it('debería lanzar NotFoundException si el core service retorna error', async () => {
      const slug = 'error-slug';

      mockRedisInstance.get.mockResolvedValue(null);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(service.resolveSlug(slug)).rejects.toThrow(NotFoundException);
    });

    it('debería manejar errores de red en el fetch', async () => {
      const slug = 'network-error';

      mockRedisInstance.get.mockResolvedValue(null);

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.resolveSlug(slug)).rejects.toThrow('Network error');
    });
  });

  describe('clearCache', () => {
    it('debería eliminar la clave del cache', async () => {
      const slug = 'mystudio';

      await service.clearCache(slug);

      expect(mockRedisInstance.del).toHaveBeenCalledWith(`tenant:${slug}`);
    });
  });
});