import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BlockedSlotsService } from "./blocked-slots.service";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { Appointment } from "../../entities/appointment.entity";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { BadRequestException, NotFoundException } from "@nestjs/common";

/** Bloquear exige futuro, así que las fechas del fixture se calculan al vuelo. */
function dentroDeDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  // Componentes locales: el servicio compara contra el día del negocio.
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

describe("BlockedSlotsService", () => {
  let service: BlockedSlotsService;
  let mockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;

  const mockBlockedSlot: BlockedSlot = {
    id: "block-123",
    businessId: "business-123",
    professionalId: "prof-123",
    date: "2024-01-15",
    startTime: "14:00",
    endTime: "15:00",
    reason: "Almuerzo",
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockPastBlockedSlot: BlockedSlot = {
    id: "block-456",
    businessId: "business-123",
    professionalId: "prof-123",
    date: "2024-01-01",
    startTime: "14:00",
    endTime: "15:00",
    reason: "Vacaciones",
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Sin citas encima: cada test que necesite un choque las pone.
    mockApptRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    const module = await Test.createTestingModule({
      providers: [
        BlockedSlotsService,
        {
          provide: getRepositoryToken(BlockedSlot),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockApptRepo,
        },
        {
          provide: ZonaDelNegocioService,
          useValue: { de: jest.fn().mockResolvedValue("America/Bogota") },
        },
      ],
    }).compile();

    service = module.get<BlockedSlotsService>(BlockedSlotsService);
  });

  describe("findByProfessional", () => {
    it("debería retornar blocked slots futuros por defecto", async () => {
      mockRepo.find.mockResolvedValue([mockBlockedSlot]);

      const result = await service.findByProfessional(
        "business-123",
        "prof-123"
      );

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          businessId: "business-123",
          professionalId: "prof-123",
          date: expect.any(Object),
        }),
        order: { date: "ASC", startTime: "ASC" },
      });
      expect(result).toEqual([mockBlockedSlot]);
    });

    it("debería retornar todos los blocked slots cuando futureOnly es false", async () => {
      mockRepo.find.mockResolvedValue([mockBlockedSlot, mockPastBlockedSlot]);

      const result = await service.findByProfessional(
        "business-123",
        "prof-123",
        false
      );

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
        },
        order: { date: "ASC", startTime: "ASC" },
      });
      expect(result).toHaveLength(2);
    });

    it("debería retornar array vacío si no hay blocked slots", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByProfessional(
        "business-123",
        "prof-123"
      );

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    const MANANA = dentroDeDias(1);

    it("debería crear un blocked slot exitosamente", async () => {
      const data = {
        date: MANANA,
        startTime: "12:00",
        endTime: "13:00",
        reason: "Cita médica",
      };

      mockRepo.create.mockReturnValue(mockBlockedSlot);
      mockRepo.save.mockResolvedValue(mockBlockedSlot);

      const result = await service.create("business-123", "prof-123", data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: "business-123",
        professionalId: "prof-123",
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockBlockedSlot);
      expect(result).toEqual(mockBlockedSlot);
    });

    it("debería crear blocked slot sin razón opcional", async () => {
      const data = {
        date: MANANA,
        startTime: "12:00",
        endTime: "13:00",
      };

      mockRepo.create.mockReturnValue(mockBlockedSlot);
      mockRepo.save.mockResolvedValue(mockBlockedSlot);

      const result = await service.create("business-123", "prof-123", data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: "business-123",
        professionalId: "prof-123",
      });
      expect(result).toEqual(mockBlockedSlot);
    });

    it("rechaza un bloqueo que termina antes de empezar", async () => {
      await expect(
        service.create("business-123", "prof-123", {
          date: MANANA,
          startTime: "15:00",
          endTime: "12:00",
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it.each(["9:0", "25:00", "abc"])("rechaza la hora %s", async (hora) => {
      await expect(
        service.create("business-123", "prof-123", {
          date: MANANA,
          startTime: hora,
          endTime: "18:00",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rechaza bloquear un dia que ya paso", async () => {
      await expect(
        service.create("business-123", "prof-123", {
          date: dentroDeDias(-1),
          startTime: "12:00",
          endTime: "13:00",
        })
      ).rejects.toThrow(BadRequestException);
    });

    // Un bloqueo encima de una cita viva la dejaba huérfana: seguía agendada en
    // una franja que la agenda ya daba por cerrada.
    it("avisa si la franja tiene citas vivas encima", async () => {
      mockApptRepo.find.mockResolvedValue([
        { startTime: "12:30", endTime: "13:30" },
      ] as never);

      await expect(
        service.create("business-123", "prof-123", {
          date: MANANA,
          startTime: "12:00",
          endTime: "13:00",
        })
      ).rejects.toThrow(/cita/i);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it("deja bloquear si las citas del dia no tocan la franja", async () => {
      mockApptRepo.find.mockResolvedValue([
        { startTime: "09:00", endTime: "10:00" },
      ] as never);
      mockRepo.create.mockReturnValue(mockBlockedSlot);
      mockRepo.save.mockResolvedValue(mockBlockedSlot);

      await expect(
        service.create("business-123", "prof-123", {
          date: MANANA,
          startTime: "12:00",
          endTime: "13:00",
        })
      ).resolves.toBeDefined();
    });

    it("debería propagar errores del repositorio", async () => {
      const data = {
        date: MANANA,
        startTime: "12:00",
        endTime: "13:00",
      };

      mockRepo.create.mockReturnValue(mockBlockedSlot);
      mockRepo.save.mockRejectedValue(new Error("Database error"));

      await expect(
        service.create("business-123", "prof-123", data)
      ).rejects.toThrow("Database error");
    });
  });

  describe("remove", () => {
    it("debería eliminar un blocked slot exitosamente", async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await service.remove("block-123", "business-123");

      expect(mockRepo.delete).toHaveBeenCalledWith({
        id: "block-123",
        businessId: "business-123",
      });
    });

    it("debería lanzar NotFoundException si el blocked slot no existe", async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.remove("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.remove("non-existent", "business-123")
      ).rejects.toThrow("Bloqueo no encontrado");
    });

    it("debería propagar errores del repositorio", async () => {
      mockRepo.delete.mockRejectedValue(new Error("Database error"));

      await expect(service.remove("block-123", "business-123")).rejects.toThrow(
        "Database error"
      );
    });
  });
});
