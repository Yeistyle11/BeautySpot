import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { ServiceUrlsConfig } from "../../config/service-urls";
import { REDIS_CLIENT } from "../redis/redis.module";

const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  disconnect: jest.fn(),
};

describe("TenantService", () => {
  let service: TenantService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockServiceUrls: jest.Mocked<ServiceUrlsConfig>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisInstance.get.mockResolvedValue(null);
    mockRedisInstance.set.mockResolvedValue("OK");
    mockRedisInstance.del.mockResolvedValue(1);

    global.fetch = jest.fn() as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockServiceUrls = {
      getUrl: jest.fn().mockReturnValue("http://localhost:3002"),
      hasUrl: jest.fn(),
      getAll: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ServiceUrlsConfig, useValue: mockServiceUrls },
        { provide: REDIS_CLIENT, useValue: mockRedisInstance },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  describe("resolveFromSubdomain", () => {
    it("debería retornar null si el host no incluye el dominio", async () => {
      mockConfigService.get.mockReturnValue("beautyspot.co");

      const result = await service.resolveFromSubdomain("external.com");

      expect(result).toBeNull();
    });

    it("debería retornar null si el subdominio es www", async () => {
      mockConfigService.get.mockReturnValue("beautyspot.co");

      const result = await service.resolveFromSubdomain("www.beautyspot.co");

      expect(result).toBeNull();
    });

    it("debería retornar null si el subdominio es api", async () => {
      mockConfigService.get.mockReturnValue("beautyspot.co");

      const result = await service.resolveFromSubdomain("api.beautyspot.co");

      expect(result).toBeNull();
    });

    it("debería extraer el subdominio y llamar a resolveSlug", async () => {
      mockConfigService.get.mockReturnValue("beautyspot.co");
      mockRedisInstance.get.mockResolvedValue("business-123");

      const result = await service.resolveFromSubdomain(
        "mystudio.beautyspot.co"
      );

      expect(result).toBe("business-123");
      expect(mockRedisInstance.get).toHaveBeenCalledWith("tenant:mystudio");
    });

    it("debería manejar hosts complejos con puertos", async () => {
      mockConfigService.get.mockReturnValue("beautyspot.co");
      mockRedisInstance.get.mockResolvedValue("business-456");

      const result = await service.resolveFromSubdomain(
        "mystudio.beautyspot.co:3000"
      );

      expect(result).toBe("business-456");
      expect(mockRedisInstance.get).toHaveBeenCalledWith("tenant:mystudio");
    });
  });

  describe("resolveSlug", () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "APP_DOMAIN") return "beautyspot.co";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });
    });

    it("debería retornar businessId desde caché si existe", async () => {
      mockRedisInstance.get.mockResolvedValue("business-123");

      const result = await service.resolveSlug("mystudio");

      expect(result).toBe("business-123");
      expect(mockRedisInstance.get).toHaveBeenCalledWith("tenant:mystudio");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("debería hacer fetch al core service si no está en caché", async () => {
      const businessId = "business-456";
      mockRedisInstance.get.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: businessId } }),
      } as any);

      const result = await service.resolveSlug("mystudio");

      expect(result).toBe(businessId);
      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith("core");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/internal/businesses/resolve?slug=mystudio"),
        expect.objectContaining({
          headers: { "x-internal-secret": "secret123" },
        })
      );
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "tenant:mystudio",
        businessId,
        "EX",
        300
      );
    });

    it("debería lanzar NotFoundException si el core service retorna 404", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not found",
      } as any);

      await expect(service.resolveSlug("nonexistent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("debería lanzar BadGatewayException si el core service retorna 500", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal error",
      } as any);

      await expect(service.resolveSlug("error-slug")).rejects.toThrow(
        BadGatewayException
      );
    });

    it("debería lanzar ServiceUnavailableException en timeout", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";
      global.fetch = jest.fn().mockRejectedValue(timeoutError);

      await expect(service.resolveSlug("timeout-slug")).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it("debería lanzar ServiceUnavailableException en error de red", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Connection refused"));

      await expect(service.resolveSlug("network-error")).rejects.toThrow(
        ServiceUnavailableException
      );
    });
  });

  describe("clearCache", () => {
    it("debería eliminar la clave del cache", async () => {
      await service.clearCache("mystudio");

      expect(mockRedisInstance.del).toHaveBeenCalledWith("tenant:mystudio");
    });
  });
});
