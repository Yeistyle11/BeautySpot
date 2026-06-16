import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CategoriesService } from "./categories.service";
import { ProfessionalCategoryEntity } from "../../entities/category.entity";
import { NotFoundException, ConflictException } from "@nestjs/common";

describe("CategoriesService", () => {
  let service: CategoriesService;
  let mockRepo: jest.Mocked<Repository<ProfessionalCategoryEntity>>;

  const mockCategory: ProfessionalCategoryEntity = {
    id: "category-123",
    businessId: "business-123",
    name: "Barbero",
    description: "Profesionales especializados en cortes de cabello",
    icon: "scissors",
    color: "#3B82F6",
    sortOrder: 0,
    active: true,
    professionals: [],
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
      count: jest.fn(),
      manager: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(ProfessionalCategoryEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe("create", () => {
    it("debería crear una categoría exitosamente", async () => {
      const dto = {
        name: "Barbero",
        description: "Profesionales especializados",
        icon: "scissors",
        color: "#3B82F6",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockCategory);
      mockRepo.save.mockResolvedValue(mockCategory);

      const result = await service.create("business-123", dto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { name: "Barbero", businessId: "business-123", active: true },
      });
      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        businessId: "business-123",
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual(mockCategory);
    });

    it("debería lanzar ConflictException si la categoría ya existe", async () => {
      const dto = { name: "Barbero" };

      mockRepo.findOne.mockResolvedValue(mockCategory);

      await expect(service.create("business-123", dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create("business-123", dto)).rejects.toThrow(
        'La categoría "Barbero" ya existe',
      );
    });

    it("debería propagar errores del repositorio", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockCategory);
      mockRepo.save.mockRejectedValue(new Error("Database error"));

      await expect(
        service.create("business-123", { name: "Nueva" }),
      ).rejects.toThrow("Database error");
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
      const inactiveCategory = { ...mockCategory, id: "cat-2", active: false } as any;
      mockRepo.find.mockResolvedValue([mockCategory, inactiveCategory]);

      const result = await service.findByBusiness("business-123", false);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        order: { sortOrder: "ASC", name: "ASC" },
      });
      expect(result).toHaveLength(2);
    });

    it("debería retornar array vacío si no hay categorías", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByBusiness("business-123");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("findById", () => {
    it("debería retornar la categoría cuando existe", async () => {
      mockRepo.findOne.mockResolvedValue(mockCategory);

      const result = await service.findById("category-123", "business-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "category-123", businessId: "business-123" },
      });
      expect(result).toEqual(mockCategory);
    });

    it("debería lanzar NotFoundException cuando la categoría no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById("non-existent", "business-123"),
      ).rejects.toThrow("Categoría no encontrada");
    });
  });

  describe("update", () => {
    it("debería actualizar la categoría correctamente", async () => {
      const updateDto = { name: "Barbero Senior", color: "#EF4444" };
      const updatedCategory = { ...mockCategory, ...updateDto } as any;

      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory) // findById
        .mockResolvedValueOnce(null) // unique check
        .mockResolvedValueOnce(updatedCategory); // findById after update
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update(
        "category-123",
        "business-123",
        updateDto,
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "category-123", businessId: "business-123" },
        updateDto,
      );
      expect(result.name).toBe("Barbero Senior");
      expect(result.color).toBe("#EF4444");
    });

    it("debería lanzar ConflictException si el nuevo nombre ya existe", async () => {
      const updateDto = { name: "Estilista" };
      const duplicate = { ...mockCategory, id: "other-id", name: "Estilista" } as any;

      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory) // findById
        .mockResolvedValueOnce(duplicate); // unique check finds duplicate

      await expect(
        service.update("category-123", "business-123", updateDto),
      ).rejects.toThrow(ConflictException);
    });

    it("debería permitir actualizar sin cambiar el nombre", async () => {
      const updateDto = { color: "#10B981" };
      const updatedCategory = { ...mockCategory, color: "#10B981" } as any;

      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory) // findById
        .mockResolvedValueOnce(updatedCategory); // findById after update
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update(
        "category-123",
        "business-123",
        updateDto,
      );

      expect(result.color).toBe("#10B981");
    });

    it("debería manejar actualización parcial", async () => {
      const updateDto = { sortOrder: 5 };
      const updatedCategory = { ...mockCategory, sortOrder: 5 } as any;

      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(updatedCategory);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update(
        "category-123",
        "business-123",
        updateDto,
      );

      expect(result.sortOrder).toBe(5);
    });
  });

  describe("remove", () => {
    it("debería desactivar la categoría (soft delete)", async () => {
      mockRepo.findOne.mockResolvedValue(mockCategory);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.remove("category-123", "business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "category-123", businessId: "business-123" },
        { active: false },
      );
    });

    it("debería lanzar NotFoundException si la categoría no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove("non-existent", "business-123"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("toggleActive", () => {
    it("debería alternar el estado activo de la categoría", async () => {
      const deactivated = { ...mockCategory, active: false } as any;

      mockRepo.findOne
        .mockResolvedValueOnce(mockCategory) // findById (active: true)
        .mockResolvedValueOnce(deactivated); // findById after toggle (active: false)
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.toggleActive(
        "category-123",
        "business-123",
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "category-123", businessId: "business-123" },
        { active: false },
      );
      expect(result.active).toBe(false);
    });

    it("debería reactivar una categoría inactiva", async () => {
      const inactive = { ...mockCategory, active: false } as any;
      const reactivated = { ...mockCategory, active: true } as any;

      mockRepo.findOne
        .mockResolvedValueOnce(inactive)
        .mockResolvedValueOnce(reactivated);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.toggleActive(
        "category-123",
        "business-123",
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "category-123", businessId: "business-123" },
        { active: true },
      );
      expect(result.active).toBe(true);
    });
  });

  describe("reorder", () => {
    it("debería reordenar las categorías", async () => {
      const items = [
        { id: "cat-1", sortOrder: 0 },
        { id: "cat-2", sortOrder: 1 },
      ];

      mockRepo.findOne.mockResolvedValue(mockCategory);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.reorder("business-123", items);

      expect(mockRepo.update).toHaveBeenCalledTimes(2);
      expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it("debería lanzar NotFoundException si una categoría no existe", async () => {
      const items = [{ id: "non-existent", sortOrder: 0 }];

      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reorder("business-123", items),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("countProfessionals", () => {
    it("debería retornar el conteo de profesionales en una categoría", async () => {
      mockRepo.findOne.mockResolvedValue(mockCategory);
      (mockRepo.manager.count as jest.Mock).mockResolvedValue(5);

      const count = await service.countProfessionals(
        "category-123",
        "business-123",
      );

      expect(count).toBe(5);
    });

    it("debería lanzar NotFoundException si la categoría no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.countProfessionals("non-existent", "business-123"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(CategoriesService);
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
      expect(typeof service.countProfessionals).toBe("function");
    });
  });
});
