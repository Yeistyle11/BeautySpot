import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ClientFieldsService } from "./client-fields.service";
import {
  CampoDeFicha,
  TipoDeCampo,
} from "../../entities/campo-de-ficha.entity";

describe("ClientFieldsService", () => {
  let service: ClientFieldsService;
  let mockRepo: jest.Mocked<Repository<CampoDeFicha>>;

  const mockCampo = {
    id: "campo-123",
    businessId: "business-123",
    etiqueta: "Alergias",
    tipo: TipoDeCampo.TEXTO,
    opciones: null,
    obligatorio: true,
    orden: 0,
    serviceIds: null,
    active: true,
  } as CampoDeFicha;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) => Promise.resolve(data)),
      findOne: jest.fn().mockResolvedValue(mockCampo),
      find: jest.fn().mockResolvedValue([mockCampo]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientFieldsService,
        { provide: getRepositoryToken(CampoDeFicha), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ClientFieldsService>(ClientFieldsService);
  });

  describe("create", () => {
    it("define el campo dentro del negocio que lo pide", async () => {
      await service.create("business-123", { etiqueta: "Alergias" });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          etiqueta: "Alergias",
          businessId: "business-123",
        })
      );
    });

    it("rechaza un campo de opciones sin opciones", async () => {
      await expect(
        service.create("business-123", {
          etiqueta: "Tipo de piel",
          tipo: TipoDeCampo.OPCIONES,
          opciones: [],
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("findByBusiness", () => {
    it("solo trae los activos y en su orden de pantalla", async () => {
      await service.findByBusiness("business-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", active: true },
        order: { orden: "ASC", createdAt: "ASC" },
      });
    });

    it("puede incluir los dados de baja", async () => {
      await service.findByBusiness("business-123", false);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: "business-123" } })
      );
    });
  });

  describe("update", () => {
    it("no deja dejar sin opciones un campo que las necesita", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockCampo,
        tipo: TipoDeCampo.OPCIONES,
        opciones: ["Grasa"],
      } as CampoDeFicha);

      await expect(
        service.update("campo-123", "business-123", { opciones: [] })
      ).rejects.toThrow(BadRequestException);
    });

    it("no toca un campo de otro negocio", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update("campo-123", "otro-negocio", { etiqueta: "X" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("da de baja el campo en vez de borrarlo", async () => {
      await service.remove("campo-123", "business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "campo-123", businessId: "business-123" },
        { active: false }
      );
    });
  });
});
