import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DataEnricherService } from "./data-enricher.service";

describe("DataEnricherService", () => {
  let service: DataEnricherService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "test-secret";
        return undefined;
      }),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        DataEnricherService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DataEnricherService>(DataEnricherService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("enrichAppointmentParticipants", () => {
    it("debería resolver datos de client, professional y business", async () => {
      const mockResponse = {
        client: { name: "Juan", email: "juan@test.com" },
        professional: { name: "Ana" },
        business: { name: "Professional", address: "Calle 1", phone: "123" },
      };
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await service.enrichAppointmentParticipants(
        "client-1",
        "prof-1",
        "biz-1"
      );

      expect(result).toEqual({
        clientName: "Juan",
        clientEmail: "juan@test.com",
        professionalName: "Ana",
        businessName: "Professional",
        businessAddress: "Calle 1",
        businessPhone: "123",
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/internal/profiles/resolve"),
        expect.objectContaining({
          headers: { "x-internal-secret": "test-secret" },
        })
      );
    });

    it("debería usar fallbacks cuando core-service responde con nulls", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          client: null,
          professional: null,
          business: null,
        }),
      } as any);

      const result = await service.enrichAppointmentParticipants(
        "client-1",
        "prof-1",
        "biz-1"
      );

      expect(result.clientName).toBe("Cliente");
      expect(result.clientEmail).toBe("");
      expect(result.professionalName).toBe("Profesional");
      expect(result.businessName).toBe("BeautySpot");
    });

    it("debería usar fallbacks cuando core-service no responde", async () => {
      jest
        .spyOn(global, "fetch")
        .mockRejectedValue(new Error("Connection refused"));

      const result = await service.enrichAppointmentParticipants(
        "client-1",
        "prof-1",
        "biz-1"
      );

      expect(result.clientName).toBe("Cliente");
      expect(result.businessName).toBe("BeautySpot");
    });

    it("debería usar fallbacks cuando core-service responde con error HTTP", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const result = await service.enrichAppointmentParticipants(
        "client-1",
        "prof-1",
        "biz-1"
      );

      expect(result.clientName).toBe("Cliente");
    });
  });

  describe("enrichClientEmail", () => {
    it("debería retornar el email del cliente", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          client: { name: "Juan", email: "juan@test.com" },
          professional: null,
          business: null,
        }),
      } as any);

      const result = await service.enrichClientEmail("client-1");

      expect(result).toBe("juan@test.com");
    });

    it("debería retornar string vacío si el cliente no se encuentra", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          client: null,
          professional: null,
          business: null,
        }),
      } as any);

      const result = await service.enrichClientEmail("nonexistent");

      expect(result).toBe("");
    });
  });

  describe("enrichBusinessData", () => {
    it("debería retornar los datos del negocio", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          client: null,
          professional: null,
          business: { name: "Elite", address: "Av 2", phone: "555" },
        }),
      } as any);

      const result = await service.enrichBusinessData("biz-1");

      expect(result).toEqual({
        businessName: "Elite",
        businessAddress: "Av 2",
        businessPhone: "555",
      });
    });
  });
});
