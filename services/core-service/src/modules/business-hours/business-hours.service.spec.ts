import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessHoursService } from "./business-hours.service";
import { BusinessHours } from "../../entities/business-hours.entity";

describe("BusinessHoursService", () => {
  let service: BusinessHoursService;
  let mockRepo: jest.Mocked<Repository<BusinessHours>>;

  const mockHours: BusinessHours = {
    id: "hours-123",
    businessId: "business-123",
    branchId: "branch-123",
    dayOfWeek: 1,
    openTime: "09:00",
    closeTime: "18:00",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {} as any,
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      create: jest.fn().mockReturnValue(mockHours),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessHoursService,
        {
          provide: getRepositoryToken(BusinessHours),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<BusinessHoursService>(BusinessHoursService);
  });

  describe("findByBusiness", () => {
    it("debería retornar todos los horarios del negocio", async () => {
      mockRepo.find.mockResolvedValue([mockHours]);

      const result = await service.findByBusiness("business-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        order: { dayOfWeek: "ASC", openTime: "ASC" },
      });
      expect(result).toEqual([mockHours]);
    });

    it("debería filtrar por sucursal cuando se proporciona branchId", async () => {
      mockRepo.find.mockResolvedValue([mockHours]);

      const result = await service.findByBusiness("business-123", "branch-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", branchId: "branch-123" },
        order: { dayOfWeek: "ASC", openTime: "ASC" },
      });
      expect(result).toEqual([mockHours]);
    });

    it("debería retornar array vacío si no hay horarios", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByBusiness("business-123");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("batchUpsert", () => {
    it("debería crear nuevos horarios cuando no existen existentes", async () => {
      const items = [
        { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" },
        { dayOfWeek: 2, openTime: "09:00", closeTime: "18:00" },
      ];

      mockRepo.find.mockResolvedValue([]);
      mockRepo.create.mockReturnValue(mockHours);
      mockRepo.save.mockImplementation((entities: any) =>
        Promise.resolve(entities)
      );

      const result = await service.batchUpsert("business-123", items);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
      });
      expect(mockRepo.remove).not.toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it("debería reemplazar horarios existentes", async () => {
      const existingHours = [mockHours];
      const newItems = [
        { dayOfWeek: 1, openTime: "10:00", closeTime: "19:00" },
      ];

      const newHours = {
        ...mockHours,
        openTime: "10:00",
        closeTime: "19:00",
      } as any;

      mockRepo.find.mockResolvedValue(existingHours);
      mockRepo.remove.mockResolvedValue({} as any);
      mockRepo.create.mockReturnValue(newHours);
      mockRepo.save.mockImplementation((entities: any) =>
        Promise.resolve(entities)
      );

      const result = await service.batchUpsert("business-123", newItems);

      expect(mockRepo.remove).toHaveBeenCalledWith(existingHours);
      expect(mockRepo.create).toHaveBeenCalledWith({
        businessId: "business-123",
        branchId: undefined,
        dayOfWeek: 1,
        openTime: "10:00",
        closeTime: "19:00",
        active: true,
      });
      expect(result).toHaveLength(1);
    });

    it("debería manejar branchId en los horarios", async () => {
      const items = [
        {
          branchId: "branch-123",
          dayOfWeek: 1,
          openTime: "09:00",
          closeTime: "18:00",
        },
      ];

      mockRepo.find.mockResolvedValue([]);
      mockRepo.create.mockReturnValue(mockHours);
      mockRepo.save.mockImplementation((entities: any) =>
        Promise.resolve(entities)
      );

      await service.batchUpsert("business-123", items);

      expect(mockRepo.create).toHaveBeenCalledWith({
        businessId: "business-123",
        branchId: "branch-123",
        dayOfWeek: 1,
        openTime: "09:00",
        closeTime: "18:00",
        active: true,
      });
    });

    it("debería respetar el valor de active", async () => {
      const items = [
        { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", active: false },
      ];

      mockRepo.find.mockResolvedValue([]);
      mockRepo.create.mockReturnValue(mockHours);
      mockRepo.save.mockImplementation((entities: any) =>
        Promise.resolve(entities)
      );

      await service.batchUpsert("business-123", items);

      expect(mockRepo.create).toHaveBeenCalledWith({
        businessId: "business-123",
        branchId: undefined,
        dayOfWeek: 1,
        openTime: "09:00",
        closeTime: "18:00",
        active: false,
      });
    });

    it("debería usar active: true por defecto", async () => {
      const items = [{ dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" }];

      mockRepo.find.mockResolvedValue([]);
      mockRepo.create.mockReturnValue(mockHours);
      mockRepo.save.mockImplementation((entities: any) =>
        Promise.resolve(entities)
      );

      await service.batchUpsert("business-123", items);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ active: true })
      );
    });
  });

  describe("updateOne", () => {
    it("debería actualizar un horario individual", async () => {
      const updateData = {
        openTime: "10:00",
        closeTime: "20:00",
      };

      const updatedHours = { ...mockHours, ...updateData } as any;

      mockRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRepo.findOne.mockResolvedValue(updatedHours);

      const result = await service.updateOne(
        "hours-123",
        "business-123",
        updateData
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "hours-123", businessId: "business-123" },
        updateData
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "hours-123", businessId: "business-123" },
      });
      expect(result.openTime).toBe("10:00");
      expect(result.closeTime).toBe("20:00");
    });

    it("debería lanzar error cuando el horario no existe", async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 } as any);
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOne("non-existent", "business-123", { openTime: "10:00" })
      ).rejects.toThrow("Horario no encontrado");
    });

    it("debería manejar actualización de active", async () => {
      const updateData = { active: false };

      const updatedHours = { ...mockHours, active: false } as any;

      mockRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRepo.findOne.mockResolvedValue(updatedHours);

      const result = await service.updateOne(
        "hours-123",
        "business-123",
        updateData
      );

      expect(result.active).toBe(false);
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(BusinessHoursService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.findByBusiness).toBe("function");
      expect(typeof service.batchUpsert).toBe("function");
      expect(typeof service.updateOne).toBe("function");
    });
  });
});
