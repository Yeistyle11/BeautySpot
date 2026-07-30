import { Test } from "@nestjs/testing";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { DataEnricherService } from "./data-enricher.service";

describe("DataEnricherService", () => {
  let service: DataEnricherService;
  let mockHttp: { pedirONulo: jest.Mock };

  beforeEach(async () => {
    mockHttp = { pedirONulo: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        DataEnricherService,
        { provide: InternalHttpClient, useValue: mockHttp },
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
      mockHttp.pedirONulo.mockResolvedValue(mockResponse);

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
      expect(mockHttp.pedirONulo).toHaveBeenCalledWith(
        "core",
        expect.stringContaining("/internal/profiles/resolve")
      );
    });

    it("debería usar fallbacks cuando core-service responde con nulls", async () => {
      mockHttp.pedirONulo.mockResolvedValue({
        client: null,
        professional: null,
        business: null,
      });

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
      mockHttp.pedirONulo.mockResolvedValue(null);

      const result = await service.enrichAppointmentParticipants(
        "client-1",
        "prof-1",
        "biz-1"
      );

      expect(result.clientName).toBe("Cliente");
      expect(result.businessName).toBe("BeautySpot");
    });

    it("debería usar fallbacks cuando core-service responde con error HTTP", async () => {
      mockHttp.pedirONulo.mockResolvedValue(null);

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
      mockHttp.pedirONulo.mockResolvedValue({
        client: { name: "Juan", email: "juan@test.com" },
        professional: null,
        business: null,
      });

      const result = await service.enrichClientEmail("client-1");

      expect(result).toBe("juan@test.com");
    });

    it("debería retornar string vacío si el cliente no se encuentra", async () => {
      mockHttp.pedirONulo.mockResolvedValue({
        client: null,
        professional: null,
        business: null,
      });

      const result = await service.enrichClientEmail("nonexistent");

      expect(result).toBe("");
    });
  });

  describe("enrichBusinessData", () => {
    it("debería retornar los datos del negocio", async () => {
      mockHttp.pedirONulo.mockResolvedValue({
        client: null,
        professional: null,
        business: { name: "Elite", address: "Av 2", phone: "555" },
      });

      const result = await service.enrichBusinessData("biz-1");

      expect(result).toEqual({
        businessName: "Elite",
        businessAddress: "Av 2",
        businessPhone: "555",
      });
    });
  });
});
