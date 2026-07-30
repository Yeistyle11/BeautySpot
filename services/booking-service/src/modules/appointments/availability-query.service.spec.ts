import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AvailabilityQueryService } from "./availability-query.service";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";

describe("AvailabilityQueryService", () => {
  let service: AvailabilityQueryService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;

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

  const mockAppointment = {
    id: "appt-123",
    businessId: "business-123",
    professionalId: "prof-123",
    date: "2024-01-15",
    startTime: "10:00",
    endTime: "11:00",
  } as Appointment;

  const mockBlockedSlot: BlockedSlot = {
    id: "block-123",
    businessId: "business-123",
    professionalId: "prof-123",
    date: "2024-01-15",
    startTime: "12:00",
    endTime: "13:00",
    reason: "Almuerzo",
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  };

  beforeEach(async () => {
    mockApptRepo = { find: jest.fn() } as never;
    mockAvailRepo = { findOne: jest.fn(), find: jest.fn() } as never;
    mockBlockRepo = { find: jest.fn() } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityQueryService,
        { provide: getRepositoryToken(Appointment), useValue: mockApptRepo },
        { provide: getRepositoryToken(Availability), useValue: mockAvailRepo },
        { provide: getRepositoryToken(BlockedSlot), useValue: mockBlockRepo },
      ],
    }).compile();

    service = module.get<AvailabilityQueryService>(AvailabilityQueryService);
  });

  describe("franjasDeProfesional", () => {
    it("debería retornar slots disponibles", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        "2024-01-15",
        60
      );

      expect(mockAvailRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
          dayOfWeek: 1,
          active: true,
        },
      });
      expect(mockBlockRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
          date: "2024-01-15",
        },
      });
    });

    it("debería retornar array vacío si no hay horario de trabajo", async () => {
      mockAvailRepo.findOne.mockResolvedValue(null);

      const result = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        "2024-01-15",
        60
      );

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("debería marcar slots como no disponibles si hay bloqueos", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([mockBlockedSlot]);
      mockApptRepo.find.mockResolvedValue([]);

      const result = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        "2024-01-15",
        30
      );

      const blockedSlot = result.find((s: any) => s.startTime === "12:00");
      expect(blockedSlot?.available).toBe(false);
    });

    it("debería marcar slots como no disponibles si hay citas existentes", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      const result = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        "2024-01-15",
        30
      );

      const bookedSlot = result.find((s: any) => s.startTime === "10:00");
      expect(bookedSlot?.available).toBe(false);
    });
  });

  describe("franjasDelNegocio", () => {
    /** Jornada de 09:00 a 10:00: dos franjas de media hora. */
    function jornadaCorta(professionalId: string) {
      return {
        ...mockAvailability,
        professionalId,
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "10:00",
      } as unknown as Availability;
    }

    beforeEach(() => {
      mockBlockRepo.find.mockResolvedValue([]);
    });

    it("ofrece la franja si la tiene libre al menos un profesional", async () => {
      mockAvailRepo.find.mockResolvedValue([
        jornadaCorta("pro-a"),
        jornadaCorta("pro-b"),
      ]);
      mockApptRepo.find.mockResolvedValue([
        { professionalId: "pro-a", startTime: "09:00", endTime: "09:30" },
      ] as never);

      const slots = await service.franjasDelNegocio(
        "business-123",
        "2026-08-19",
        30
      );

      expect(slots.find((s) => s.startTime === "09:00")?.available).toBe(true);
    });

    it("consulta el equipo entero de una vez, sin repetir por profesional", async () => {
      mockAvailRepo.find.mockResolvedValue([
        jornadaCorta("pro-a"),
        jornadaCorta("pro-b"),
        jornadaCorta("pro-c"),
      ]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.franjasDelNegocio("business-123", "2026-08-19", 30);

      // Una consulta de horarios, una de bloqueos y una de citas: el coste no
      // debe crecer con el tamaño del equipo.
      expect(mockAvailRepo.find).toHaveBeenCalledTimes(1);
      expect(mockBlockRepo.find).toHaveBeenCalledTimes(1);
      expect(mockApptRepo.find).toHaveBeenCalledTimes(1);
      expect(mockAvailRepo.findOne).not.toHaveBeenCalled();
    });

    it("marca la franja ocupada cuando ninguno la tiene libre", async () => {
      mockAvailRepo.find.mockResolvedValue([
        jornadaCorta("pro-a"),
        jornadaCorta("pro-b"),
      ]);
      mockApptRepo.find.mockResolvedValue([
        { professionalId: "pro-a", startTime: "09:00", endTime: "09:30" },
        { professionalId: "pro-b", startTime: "09:00", endTime: "09:30" },
      ] as never);

      const slots = await service.franjasDelNegocio(
        "business-123",
        "2026-08-19",
        30
      );

      expect(slots.find((s) => s.startTime === "09:00")?.available).toBe(false);
    });

    it("devuelve las franjas ordenadas y sin repetir", async () => {
      mockAvailRepo.find.mockResolvedValue([
        jornadaCorta("pro-a"),
        jornadaCorta("pro-b"),
      ]);
      mockApptRepo.find.mockResolvedValue([]);

      const slots = await service.franjasDelNegocio(
        "business-123",
        "2026-08-19",
        30
      );

      const horas = slots.map((s) => s.startTime);
      expect(horas).toEqual([...new Set(horas)]);
      expect(horas).toEqual([...horas].sort());
    });

    it("no ofrece nada si nadie del equipo trabaja ese dia", async () => {
      mockAvailRepo.find.mockResolvedValue([]);

      const slots = await service.franjasDelNegocio(
        "business-123",
        "2026-08-19",
        30
      );

      expect(slots).toEqual([]);
      expect(mockAvailRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe("franjasDeProfesionalPublico", () => {
    it("deduce el negocio del horario del profesional", async () => {
      mockAvailRepo.findOne.mockResolvedValue({
        id: "avail-1",
        businessId: "business-123",
        professionalId: "pro-1",
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "10:00",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        generateId: () => {},
      } as unknown as Availability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      const slots = await service.franjasDeProfesionalPublico(
        "pro-1",
        "2026-08-19",
        30
      );

      expect(slots.length).toBeGreaterThan(0);
    });

    it("no devuelve horarios de un profesional sin agenda configurada", async () => {
      mockAvailRepo.findOne.mockResolvedValue(null);

      const slots = await service.franjasDeProfesionalPublico(
        "pro-desconocido",
        "2026-08-19",
        30
      );

      expect(slots).toEqual([]);
    });
  });

  describe("franjaDentroDelHorario", () => {
    it("acepta una franja dentro de la jornada y sin bloqueos", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);

      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          "2024-01-15",
          "10:00",
          "11:00",
          1
        )
      ).resolves.toBe(true);
    });

    it("rechaza si el profesional no trabaja ese día", async () => {
      mockAvailRepo.findOne.mockResolvedValue(null);

      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          "2024-01-15",
          "10:00",
          "11:00",
          1
        )
      ).resolves.toBe(false);
    });

    it("rechaza si la franja se sale de la jornada", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);

      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          "2024-01-15",
          "17:30",
          "19:30",
          1
        )
      ).resolves.toBe(false);
    });

    it("rechaza si choca con un bloqueo", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([mockBlockedSlot]);

      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          "2024-01-15",
          "12:30",
          "13:30",
          1
        )
      ).resolves.toBe(false);
    });
  });

  describe("hayConflicto", () => {
    it("detecta una cita viva que se solapa", async () => {
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      await expect(
        service.hayConflicto(
          "business-123",
          "prof-123",
          "2024-01-15",
          "10:30",
          "11:30"
        )
      ).resolves.toBe(true);
    });

    it("no ve conflicto con una franja libre", async () => {
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      await expect(
        service.hayConflicto(
          "business-123",
          "prof-123",
          "2024-01-15",
          "16:00",
          "17:00"
        )
      ).resolves.toBe(false);
    });

    it("ignora la propia cita al reagendarla", async () => {
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      await expect(
        service.hayConflicto(
          "business-123",
          "prof-123",
          "2024-01-15",
          "10:30",
          "11:30",
          "appt-123"
        )
      ).resolves.toBe(false);
    });
  });

  describe("hayConflictoEn", () => {
    it("consulta con el manager de la transacción, no con el repositorio", async () => {
      const manager = { find: jest.fn().mockResolvedValue([mockAppointment]) };

      // Es el chequeo autoritativo dentro de la transacción SERIALIZABLE: si
      // leyera por el repositorio quedaría fuera del aislamiento.
      await expect(
        service.hayConflictoEn(
          manager as never,
          "business-123",
          "prof-123",
          "2024-01-15",
          "10:30",
          "11:30"
        )
      ).resolves.toBe(true);
      expect(manager.find).toHaveBeenCalled();
      expect(mockApptRepo.find).not.toHaveBeenCalled();
    });
  });
});
