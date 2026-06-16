import { Test } from '@nestjs/testing';
import { ProxyService } from './proxy.service';
import { ServiceUrlsConfig } from '../../config/service-urls';

describe('ProxyService', () => {
  let service: ProxyService;
  let mockServiceUrls: jest.Mocked<ServiceUrlsConfig>;

  beforeEach(async () => {
    mockServiceUrls = {
      getUrl: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ProxyService,
        {
          provide: ServiceUrlsConfig,
          useValue: mockServiceUrls,
        },
      ],
    }).compile();

    service = module.get<ProxyService>(ProxyService);
  });

  describe('getServiceUrl', () => {
    it('debería normalizar el nombre del servicio y obtener la URL', () => {
      mockServiceUrls.getUrl.mockReturnValue('http://localhost:3002');

      const result = service.getServiceUrl('core-service');

      expect(result).toBe('http://localhost:3002');
      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith('core');
    });

    it('debería manejar nombres sin sufijo -service', () => {
      mockServiceUrls.getUrl.mockReturnValue('http://localhost:3001');

      const result = service.getServiceUrl('auth');

      expect(result).toBe('http://localhost:3001');
      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith('auth');
    });

    it('debería pasar el nombre normalizado al configurador', () => {
      mockServiceUrls.getUrl.mockReturnValue('http://localhost:3003');

      service.getServiceUrl('booking-service');

      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith('booking');
    });
  });

  describe('isValidService', () => {
    it('debería validar servicios conocidos con sufijo -service', () => {
      expect(service.isValidService('auth-service')).toBe(true);
      expect(service.isValidService('core-service')).toBe(true);
      expect(service.isValidService('booking-service')).toBe(true);
      expect(service.isValidService('payment-service')).toBe(true);
      expect(service.isValidService('notification-service')).toBe(true);
      expect(service.isValidService('marketplace-service')).toBe(true);
      expect(service.isValidService('analytics-service')).toBe(true);
    });

    it('debería validar servicios conocidos sin sufijo -service', () => {
      expect(service.isValidService('auth')).toBe(true);
      expect(service.isValidService('core')).toBe(true);
      expect(service.isValidService('booking')).toBe(true);
    });

    it('debería rechazar servicios desconocidos', () => {
      expect(service.isValidService('unknown-service')).toBe(false);
      expect(service.isValidService('fake-service')).toBe(false);
      expect(service.isValidService('random')).toBe(false);
    });

    it('debería ser case-sensitive para nombres de servicio', () => {
      expect(service.isValidService('Auth-Service')).toBe(false);
      expect(service.isValidService('AUTH')).toBe(false);
    });
  });
});