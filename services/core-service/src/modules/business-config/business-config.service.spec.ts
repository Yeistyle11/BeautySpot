import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BusinessConfigService } from "./business-config.service";
import { BusinessConfig } from "../../entities/business-config.entity";

describe("BusinessConfigService", () => {
  let service: BusinessConfigService;
  let mockRepo: { findOne: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessConfigService,
        { provide: getRepositoryToken(BusinessConfig), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BusinessConfigService>(BusinessConfigService);
  });

  describe("leer", () => {
    it("devuelve un objeto vacío si el negocio no tocó la clave", async () => {
      expect(await service.leer("business-123", "facturacion")).toEqual({});
    });

    it("devuelve lo guardado", async () => {
      mockRepo.findOne.mockResolvedValue({ value: { serie: "FA" } });

      expect(await service.leer("business-123", "facturacion")).toEqual({
        serie: "FA",
      });
    });
  });

  describe("guardar", () => {
    it("mezcla los cambios con lo que ya había", async () => {
      mockRepo.findOne.mockResolvedValue({
        value: { nit: "900123", serie: "INV" },
      });

      const resultado = await service.guardar("business-123", "facturacion", {
        serie: "FA",
      });

      expect(resultado).toEqual({ nit: "900123", serie: "FA" });
      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: "business-123",
          key: "facturacion",
          value: { nit: "900123", serie: "FA" },
        }),
        ["businessId", "key"]
      );
    });
  });
});
