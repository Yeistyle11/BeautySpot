import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServicesService } from "./services.service";
import { Service } from "../../entities/service.entity";
import { NotFoundException } from "@nestjs/common";

describe("ServicesService", () => {
  let service: ServicesService;
  let mockRepo: jest.Mocked<Repository<Service>>;

  const mockService: Service = {
    id: "service-123",
    businessId: "business-123",
    name: "Corte de Cabello",
    description: "Corte profesional para hombres",
    category: "Haircut",
    duration: 30,
    price: 45000,
    active: true,
    image: "",
    categoryId: "category-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {} as any,
    categoryRef: {} as any,
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: getRepositoryToken(Service),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  describe("create", () => {
    it("debería crear un servicio exitosamente", async () => {
      const data = {
        name: "Corte de Cabello",
        description: "Corte profesional",
        category: "Haircut",
        duration: 30,
        price: 45000,
      };

      mockRepo.create.mockReturnValue(mockService);
      mockRepo.save.mockResolvedValue(mockService);

      const result = await service.create("business-123", data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: "business-123",
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockService);
      expect(result).toEqual(mockService);
    });

    it("debería propagar errores del repositorio", async () => {
      mockRepo.save.mockRejectedValue(new Error("Database error"));

      await expect(service.create("business-123", {})).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("findByBusiness", () => {
    it("debería retornar todos los servicios del negocio (incluyendo inactivos)", async () => {
      mockRepo.find.mockResolvedValue([mockService]);

      const result = await service.findByBusiness("business-123", false);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        order: { category: "ASC", name: "ASC" },
      });
      expect(result).toEqual([mockService]);
    });

    it("debería retornar solo servicios activos", async () => {
      mockRepo.find.mockResolvedValue([mockService]);

      const result = await service.findByBusiness("business-123", true);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", active: true },
        order: { category: "ASC", name: "ASC" },
      });
      expect(result).toEqual([mockService]);
    });

    it("debería retornar array vacío si no hay servicios", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByBusiness("business-123");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("debería ordenar por categoría y luego por nombre", async () => {
      const service2 = {
        ...mockService,
        id: "service-2",
        name: "Barba",
        category: "Beard",
      } as any;
      const service3 = {
        ...mockService,
        id: "service-3",
        name: "Color",
        category: "Haircut",
      } as any;

      mockRepo.find.mockResolvedValue([service2, mockService, service3]);

      const result = await service.findByBusiness("business-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        order: { category: "ASC", name: "ASC" },
      });
      expect(result).toHaveLength(3);
    });
  });

  describe("findById", () => {
    it("debería retornar el servicio cuando existe", async () => {
      mockRepo.findOne.mockResolvedValue(mockService);

      const result = await service.findById("service-123", "business-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "service-123", businessId: "business-123" },
      });
      expect(result).toEqual(mockService);
    });

    it("debería lanzar NotFoundException cuando el servicio no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow("Servicio no encontrado");
    });
  });

  describe("update", () => {
    it("debería actualizar el servicio correctamente", async () => {
      const updateData = {
        name: "Corte Premium",
        price: 55000,
      };

      const updatedService = { ...mockService, ...updateData } as any;

      mockRepo.findOne.mockResolvedValue(updatedService);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update(
        "service-123",
        "business-123",
        updateData
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "service-123", businessId: "business-123" },
        updateData
      );
      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(result.name).toBe("Corte Premium");
      expect(result.price).toBe(55000);
    });

    it("debería manejar actualización parcial", async () => {
      const updateData = { duration: 45 };

      const updatedService = { ...mockService, duration: 45 } as any;

      mockRepo.findOne.mockResolvedValue(updatedService);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update(
        "service-123",
        "business-123",
        updateData
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "service-123", businessId: "business-123" },
        updateData
      );
      expect(result.duration).toBe(45);
    });
  });

  describe("softDelete", () => {
    it("debería desactivar el servicio (soft delete)", async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.softDelete("service-123", "business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "service-123", businessId: "business-123" },
        { active: false }
      );
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(ServicesService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.create).toBe("function");
      expect(typeof service.findByBusiness).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.update).toBe("function");
      expect(typeof service.softDelete).toBe("function");
    });
  });
});
