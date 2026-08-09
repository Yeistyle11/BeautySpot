import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AvailabilityService } from "./availability.service";
import { Availability } from "../../entities/availability.entity";

describe("AvailabilityService", () => {
  let service: AvailabilityService;
  let mockRepo: jest.Mocked<Repository<Availability>>;

  const mockAvailability: Availability = {
    id: "avail-123",
    businessId: "business-123",
    professionalId: "prof-123",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "18:00",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    // La transacción entrega el mismo repositorio simulado del test.
    const mockDataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) =>
        cb({ getRepository: jest.fn().mockReturnValue(mockRepo) })
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(Availability),
          useValue: mockRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  describe("findByProfessional", () => {
    it("debería retornar disponibilidad activa del profesional", async () => {
      mockRepo.find.mockResolvedValue([mockAvailability]);

      const result = await service.findByProfessional(
        "business-123",
        "prof-123"
      );

      expect(result).toEqual([mockAvailability]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
          active: true,
        },
        order: { dayOfWeek: "ASC", startTime: "ASC" },
      });
    });

    it("debería retornar array vacío si no hay disponibilidad", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByProfessional(
        "business-123",
        "prof-123"
      );

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
          active: true,
        },
        order: { dayOfWeek: "ASC", startTime: "ASC" },
      });
    });
  });

  describe("replaceWeekly", () => {
    it("debería reemplazar toda la disponibilidad semanal", async () => {
      const slots = [
        { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
      ];

      mockRepo.delete.mockResolvedValue({ affected: 3 } as any);
      mockRepo.create.mockReturnValue(mockAvailability as any);
      mockRepo.save.mockResolvedValue([mockAvailability] as any);

      const result = await service.replaceWeekly(
        "business-123",
        "prof-123",
        slots
      );

      expect(mockRepo.delete).toHaveBeenCalledWith({
        businessId: "business-123",
        professionalId: "prof-123",
      });
      expect(mockRepo.create).toHaveBeenCalledTimes(3);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it("debería manejar reemplazo vacío", async () => {
      mockRepo.delete.mockResolvedValue({ affected: 5 } as any);
      mockRepo.save.mockResolvedValue([] as any);

      const result = await service.replaceWeekly(
        "business-123",
        "prof-123",
        []
      );

      expect(mockRepo.delete).toHaveBeenCalledWith({
        businessId: "business-123",
        professionalId: "prof-123",
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });
  });

  describe("validación de los tramos", () => {
    beforeEach(() => {
      mockRepo.delete.mockResolvedValue({ affected: 0 } as never);
      mockRepo.create.mockReturnValue(mockAvailability as never);
      mockRepo.save.mockResolvedValue([] as never);
    });

    /** Intenta guardar esos tramos para el profesional de la prueba. */
    const guardar = (
      slots: { dayOfWeek: number; startTime: string; endTime: string }[]
    ) => service.replaceWeekly("business-123", "prof-123", slots);

    it("acepta dos tramos del mismo día que no se pisan", async () => {
      await expect(
        guardar([
          { dayOfWeek: 3, startTime: "09:00", endTime: "13:00" },
          { dayOfWeek: 3, startTime: "15:00", endTime: "19:00" },
        ])
      ).resolves.toBeDefined();
    });

    it("rechaza dos tramos del mismo día que se solapan", async () => {
      await expect(
        guardar([
          { dayOfWeek: 3, startTime: "09:00", endTime: "14:00" },
          { dayOfWeek: 3, startTime: "13:00", endTime: "19:00" },
        ])
      ).rejects.toThrow(BadRequestException);
    });

    it("permite el mismo tramo en días distintos", async () => {
      await expect(
        guardar([
          { dayOfWeek: 3, startTime: "09:00", endTime: "14:00" },
          { dayOfWeek: 4, startTime: "09:00", endTime: "14:00" },
        ])
      ).resolves.toBeDefined();
    });

    it("rechaza un tramo que termina antes de empezar", async () => {
      await expect(
        guardar([{ dayOfWeek: 3, startTime: "18:00", endTime: "09:00" }])
      ).rejects.toThrow(BadRequestException);
    });

    it.each(["9:0", "25:00", "abc"])("rechaza la hora %s", async (hora) => {
      await expect(
        guardar([{ dayOfWeek: 3, startTime: hora, endTime: "19:00" }])
      ).rejects.toThrow(BadRequestException);
    });

    it("no borra nada si la validación falla", async () => {
      await expect(
        guardar([{ dayOfWeek: 3, startTime: "18:00", endTime: "09:00" }])
      ).rejects.toThrow();

      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AvailabilityService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.findByProfessional).toBe("function");
      expect(typeof service.replaceWeekly).toBe("function");
    });
  });
});
