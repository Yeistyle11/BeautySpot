import { Test } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { Role } from "@beautyspot/shared-types";
import { ProxyService } from "./proxy.service";
import { ServiceUrlsConfig } from "../../config/service-urls";

describe("ProxyService", () => {
  let service: ProxyService;
  let mockServiceUrls: jest.Mocked<ServiceUrlsConfig>;

  beforeEach(async () => {
    mockServiceUrls = {
      getUrl: jest.fn(),
      hasUrl: jest.fn(),
      getAll: jest.fn(),
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

  describe("buildForwardedHeaders", () => {
    const NEGOCIO_A = "11111111-1111-4111-8111-111111111111";
    const NEGOCIO_B = "22222222-2222-4222-8222-222222222222";
    const AJENO = "33333333-3333-4333-8333-333333333333";

    /** Petición con la sesión ya resuelta por el guard del gateway. */
    function peticion(user: unknown, pedido?: string) {
      return {
        method: "GET",
        headers: {
          authorization: "Bearer t",
          ...(pedido ? { "x-business-id": pedido } : {}),
        },
        user,
      } as never;
    }

    it("usa el negocio por defecto cuando el cliente no pide ninguno", () => {
      const headers = service.buildForwardedHeaders(
        peticion({ businessId: NEGOCIO_A, businessIds: [NEGOCIO_A] })
      );

      expect(headers["x-business-id"]).toBe(NEGOCIO_A);
    });

    // Quien trabaja en dos sitios tiene que poder decir en cuál está.
    it("respeta el negocio que pide el cliente si tiene membresía", () => {
      const headers = service.buildForwardedHeaders(
        peticion(
          { businessId: NEGOCIO_A, businessIds: [NEGOCIO_A, NEGOCIO_B] },
          NEGOCIO_B
        )
      );

      expect(headers["x-business-id"]).toBe(NEGOCIO_B);
    });

    it("rechaza un negocio en el que el usuario no tiene membresía", () => {
      expect(() =>
        service.buildForwardedHeaders(
          peticion({ businessId: NEGOCIO_A, businessIds: [NEGOCIO_A] }, AJENO)
        )
      ).toThrow(ForbiddenException);
    });

    it("SUPER_ADMIN puede operar sobre cualquier negocio", () => {
      const headers = service.buildForwardedHeaders(
        peticion({ role: Role.SUPER_ADMIN, businessIds: [] }, AJENO)
      );

      expect(headers["x-business-id"]).toBe(AJENO);
    });

    it("no manda negocio si la petición no lleva sesión", () => {
      const headers = service.buildForwardedHeaders(peticion(undefined));

      expect(headers["x-business-id"]).toBeUndefined();
    });

    it("reenvía la sede que pide el cliente", () => {
      const req = peticion({
        businessId: NEGOCIO_A,
        businessIds: [NEGOCIO_A],
      }) as unknown as { headers: Record<string, string> };
      req.headers["x-branch-id"] = "sede-1";

      const headers = service.buildForwardedHeaders(req as never);

      expect(headers["x-branch-id"]).toBe("sede-1");
    });

    it("sin sede no manda la cabecera", () => {
      const headers = service.buildForwardedHeaders(
        peticion({ businessId: NEGOCIO_A, businessIds: [NEGOCIO_A] })
      );

      expect(headers["x-branch-id"]).toBeUndefined();
    });
  });

  describe("getServiceUrl", () => {
    it("debería normalizar el nombre del servicio y obtener la URL", () => {
      mockServiceUrls.getUrl.mockReturnValue("http://localhost:3002");

      const result = service.getServiceUrl("core-service");

      expect(result).toBe("http://localhost:3002");
      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith("core");
    });

    it("debería manejar nombres sin sufijo -service", () => {
      mockServiceUrls.getUrl.mockReturnValue("http://localhost:3001");

      const result = service.getServiceUrl("auth");

      expect(result).toBe("http://localhost:3001");
      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith("auth");
    });

    it("debería pasar el nombre normalizado al configurador", () => {
      mockServiceUrls.getUrl.mockReturnValue("http://localhost:3003");

      service.getServiceUrl("booking-service");

      expect(mockServiceUrls.getUrl).toHaveBeenCalledWith("booking");
    });
  });

  describe("isValidService", () => {
    it("debería validar servicios conocidos con sufijo -service", () => {
      mockServiceUrls.hasUrl.mockReturnValue(true);

      expect(service.isValidService("auth-service")).toBe(true);
      expect(service.isValidService("core-service")).toBe(true);
      expect(service.isValidService("booking-service")).toBe(true);
      expect(service.isValidService("payment-service")).toBe(true);
      expect(service.isValidService("notification-service")).toBe(true);
      expect(service.isValidService("marketplace-service")).toBe(true);
      expect(service.isValidService("analytics-service")).toBe(true);
    });

    it("debería validar servicios conocidos sin sufijo -service", () => {
      mockServiceUrls.hasUrl.mockReturnValue(true);

      expect(service.isValidService("auth")).toBe(true);
      expect(service.isValidService("core")).toBe(true);
      expect(service.isValidService("booking")).toBe(true);
    });

    it("debería rechazar servicios desconocidos", () => {
      mockServiceUrls.hasUrl.mockReturnValue(false);

      expect(service.isValidService("unknown-service")).toBe(false);
      expect(service.isValidService("fake-service")).toBe(false);
      expect(service.isValidService("random")).toBe(false);
    });

    it("debería ser case-sensitive para nombres de servicio", () => {
      mockServiceUrls.hasUrl.mockReturnValue(false);

      expect(service.isValidService("Auth-Service")).toBe(false);
      expect(service.isValidService("AUTH")).toBe(false);
    });
  });
});
