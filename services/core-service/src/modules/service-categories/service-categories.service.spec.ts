import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServiceCategoriesService } from "./service-categories.service";
import { ServiceCategoryEntity } from "../../entities/service-category.entity";
import { NotFoundException, ConflictException } from "@nestjs/common";

describe("ServiceCategoriesService", () => {
  let service: ServiceCategoriesService;
  let mockRepo: jest.Mocked<Repository<ServiceCategoryEntity>>;

  const mockCategory: ServiceCategoryEntity = {
    id: "scat-123",
    businessId: "business-123",
    name: "Cortes",
    description: "Servicios de corte de cabello",
    icon: "scissors",
    color: "#3B82F6",
    sortOrder: 0,
    active: true,
    services: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      manager: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCategoriesService,
        {
          provide: getRepositoryToken(ServiceCategoryEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ServiceCategoriesService>(ServiceCategoriesService);
  });

  describe("create", () => {
    it("debería crear una categoría de servicio exitosamente", async () => {
      const dto = { name: "Cortes", description: "Servicios de corte", color: "#3B82F6" };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockCategory);
      mockRepo.save.mockResolvedValue(mockCategory);

      const result = await service.create("business-123", dto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { name: "Cortes", businessId: "business-123", active: true },
      });
      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, businessId: "business-123" });
      expect(result).toEqual(mockCategory);
    });

    it("debería lanzar ConflictException si la categoría ya existe", async () => {
      mockRepo.findOne.mockResolvedValue(mockCategory);

      await expect(service.create("business-123", { name: "Cortes" })).rejects.toThrow(ConflictException);
    });
  });

  describe("findByBusiness", () => {
    it("debería retornar solo categorías activas por defecto", async () => {
      mockRepo.find.mockResolvedValue([mockCategory]);

      const result = await service.findByBusiness("business-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", active: true },
        order: { sortOrder: "ASC", name: "ASC" },
      });
      expect(result).toEqual([mockCategory]);
    });

    it("debería retornar todas las categorías (incluyendo inactivas)", async () => {
      const inactive = { ...mockCategory, id: "scat-2", active: false } as any;
      mockRepo.find.mockResolvedValue([mockCategory, inactive]);

      const result = await service.findByBusiness("business-123", false);

      expect(result).toHaveLength(2);
    });

    it("debería retornar array vacío si no hay categorías", async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.findByBusiness("business-123");
      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("debería retornar la categoría cuando existe", async () => {
      mockRepo.findOne.mockResolvedValue(mockCategory);
      const result = await service.findById("scat-123", "business-123");
      expect(result).toEqual(mockCategory);
    });

    it("debería lanzar NotFoundException cuando no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById("x", "business-123")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("debería actualizar la categoría correctamente", async () => {
      const updated = { ...mockCategory, name: "Cortes Premium" } as any;
      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update("scat-123", "business-123", { name: "Cortes Premium" });
      expect(result.name).toBe("Cortes Premium");
    });

    it("debería lanzar ConflictException si el nuevo nombre ya existe", async () => {
      const duplicate = { ...mockCategory, id: "other", name: "Barba" } as any;
      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(duplicate);

      await expect(service.update("scat-123", "business-123", { name: "Barba" })).rejects.toThrow(ConflictException);
    });
  });

  describe("remove", () => {
    it("debería desactivar la categoría (soft delete)", async () => {
      mockRepo.findOne.mockResolvedValue(mockCategory);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.remove("scat-123", "business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "scat-123", businessId: "business-123" },
        { active: false },
      );
    });
  });

  describe("toggleActive", () => {
    it("debería alternar el estado activo", async () => {
      const deactivated = { ...mockCategory, active: false } as any;
      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(deactivated);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.toggleActive("scat-123", "business-123");
      expect(result.active).toBe(false);
    });
  });

  describe("reorder", () => {
    it("debería reordenar las categorías", async () => {
      const items = [{ id: "scat-1", sortOrder: 0 }, { id: "scat-2", sortOrder: 1 }];
      mockRepo.findOne.mockResolvedValue(mockCategory);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.reorder("business-123", items);
      expect(mockRepo.update).toHaveBeenCalledTimes(2);
    });

    it("debería lanzar NotFoundException si una categoría no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.reorder("business-123", [{ id: "x", sortOrder: 0 }])).rejects.toThrow(NotFoundException);
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(ServiceCategoriesService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.create).toBe("function");
      expect(typeof service.findByBusiness).toBe("function");
      expect(typeof service.findPaginated).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.update).toBe("function");
      expect(typeof service.remove).toBe("function");
      expect(typeof service.toggleActive).toBe("function");
      expect(typeof service.reorder).toBe("function");
    });
  });
});
