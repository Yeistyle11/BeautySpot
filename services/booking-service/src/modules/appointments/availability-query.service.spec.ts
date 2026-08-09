import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FindOperator, Repository } from "typeorm";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { AvailabilityQueryService } from "./availability-query.service";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { HorarioDelNegocioService } from "./horario-del-negocio.service";

/**
 * Miércoles futuro, calculado y no escrito a mano: el servicio marca no
 * disponible toda franja que ya pasó, así que una fecha fija deja de ofrecer
 * huecos en cuanto el calendario la alcanza y tumba la suite sin que nadie haya
 * tocado el código. Miércoles para que case con el `dayOfWeek: 3` de
 * `jornadaCorta`.
 */
const MIERCOLES_FUTURO = (() => {
  const dia = new Date();
  dia.setUTCDate(dia.getUTCDate() + 7 + ((3 - dia.getUTCDay() + 7) % 7));
  return dia.toISOString().slice(0, 10);
})();

describe("AvailabilityQueryService", () => {
  let service: AvailabilityQueryService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockZonas: { de: jest.Mock };
  let mockHorario: { tramosDelDia: jest.Mock };

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
    mockZonas = { de: jest.fn().mockResolvedValue("America/Bogota") };
    // Por defecto el negocio no tiene horario configurado, así que la agenda la
    // limita solo el horario del profesional.
    mockHorario = { tramosDelDia: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityQueryService,
        { provide: getRepositoryToken(Appointment), useValue: mockApptRepo },
        { provide: getRepositoryToken(Availability), useValue: mockAvailRepo },
        { provide: getRepositoryToken(BlockedSlot), useValue: mockBlockRepo },
        { provide: ZonaDelNegocioService, useValue: mockZonas },
        { provide: HorarioDelNegocioService, useValue: mockHorario },
      ],
    }).compile();

    service = module.get<AvailabilityQueryService>(AvailabilityQueryService);
  });

  describe("franjasDeProfesional", () => {
    it("debería retornar slots disponibles", async () => {
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        "2024-01-15",
        60
      );

      // Se piden todos los tramos del día, no solo el primero: la jornada
      // partida son varias filas.
      expect(mockAvailRepo.find).toHaveBeenCalledWith({
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
      mockAvailRepo.find.mockResolvedValue([]);

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
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
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
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
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
        MIERCOLES_FUTURO,
        30
      );

      expect(slots.find((s) => s.startTime === "09:00")?.available).toBe(true);
    });

    it("no ofrece franjas de una fecha ya pasada", async () => {
      mockAvailRepo.find.mockResolvedValue([jornadaCorta("pro-a")]);
      mockApptRepo.find.mockResolvedValue([]);

      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const slots = await service.franjasDelNegocio("business-123", ayer, 30);

      expect(slots.every((s) => !s.available)).toBe(true);
    });

    it("consulta el equipo entero de una vez, sin repetir por profesional", async () => {
      mockAvailRepo.find.mockResolvedValue([
        jornadaCorta("pro-a"),
        jornadaCorta("pro-b"),
        jornadaCorta("pro-c"),
      ]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.franjasDelNegocio("business-123", MIERCOLES_FUTURO, 30);

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
        MIERCOLES_FUTURO,
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
        MIERCOLES_FUTURO,
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
        MIERCOLES_FUTURO,
        30
      );

      expect(slots).toEqual([]);
      expect(mockAvailRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe("franjasDeProfesionalPublico", () => {
    /** Tramo del miércoles, en el negocio indicado. */
    function tramoDe(businessId: string) {
      return {
        ...mockAvailability,
        businessId,
        professionalId: "pro-1",
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "10:00",
      } as unknown as Availability;
    }

    it("deduce el negocio del horario del profesional", async () => {
      mockAvailRepo.find.mockResolvedValue([tramoDe("business-123")]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      const slots = await service.franjasDeProfesionalPublico(
        "pro-1",
        MIERCOLES_FUTURO,
        30
      );

      expect(slots.length).toBeGreaterThan(0);
    });

    it("no devuelve horarios de un profesional sin agenda configurada", async () => {
      mockAvailRepo.find.mockResolvedValue([]);

      const slots = await service.franjasDeProfesionalPublico(
        "pro-desconocido",
        MIERCOLES_FUTURO,
        30
      );

      expect(slots).toEqual([]);
    });

    // La ruta pública no dice de qué negocio se pregunta.
    it("no elige negocio al azar si el profesional trabaja en varios", async () => {
      mockAvailRepo.find.mockResolvedValue([
        tramoDe("business-123"),
        tramoDe("business-456"),
      ]);

      const slots = await service.franjasDeProfesionalPublico(
        "pro-1",
        MIERCOLES_FUTURO,
        30
      );

      expect(slots).toEqual([]);
    });
  });

  describe("turnos partidos", () => {
    /** Jornada 09:00-13:00 y 15:00-19:00, el patrón del sector. */
    function jornadaPartida() {
      return [
        {
          ...mockAvailability,
          dayOfWeek: 3,
          startTime: "09:00",
          endTime: "13:00",
        },
        {
          ...mockAvailability,
          id: "avail-tarde",
          dayOfWeek: 3,
          startTime: "15:00",
          endTime: "19:00",
        },
      ] as unknown as Availability[];
    }

    beforeEach(() => {
      mockAvailRepo.find.mockResolvedValue(jornadaPartida());
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);
    });

    it("ofrece los dos tramos y no la hora del almuerzo", async () => {
      const slots = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        MIERCOLES_FUTURO,
        30
      );

      const horas = slots.map((s) => s.startTime);
      expect(horas).toContain("12:30");
      expect(horas).toContain("15:00");
      // Entre las 13:00 y las 15:00 el profesional no está.
      expect(horas).not.toContain("13:00");
      expect(horas).not.toContain("14:30");
    });

    it("no deja que una cita cruce el corte de la jornada", async () => {
      // 12:30 + 60 min terminaría a las 13:30, ya fuera del tramo de mañana.
      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          MIERCOLES_FUTURO,
          "12:30",
          "13:30",
          3
        )
      ).resolves.toBe(false);
    });

    it("acepta una cita que cabe entera en el tramo de tarde", async () => {
      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          MIERCOLES_FUTURO,
          "15:00",
          "16:00",
          3
        )
      ).resolves.toBe(true);
    });
  });

  describe("horario de apertura del negocio", () => {
    beforeEach(() => {
      // El profesional atiende hasta las 18:00.
      mockAvailRepo.find.mockResolvedValue([
        { ...mockAvailability, dayOfWeek: 3 } as unknown as Availability,
      ]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);
    });

    it("no ofrece franjas después de que el negocio cierre", async () => {
      mockHorario.tramosDelDia.mockResolvedValue([
        { startTime: "09:00", endTime: "14:00" },
      ]);

      const slots = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        MIERCOLES_FUTURO,
        30
      );

      expect(slots.find((s) => s.startTime === "13:30")?.available).toBe(true);
      expect(slots.find((s) => s.startTime === "15:00")?.available).toBe(false);
    });

    it("rechaza reservar fuera del horario de apertura", async () => {
      mockHorario.tramosDelDia.mockResolvedValue([
        { startTime: "09:00", endTime: "14:00" },
      ]);

      await expect(
        service.franjaDentroDelHorario(
          "business-123",
          "prof-123",
          MIERCOLES_FUTURO,
          "15:00",
          "16:00",
          3
        )
      ).resolves.toBe(false);
    });

    it("considera cerrado un día sin tramos, si el negocio tiene horario", async () => {
      mockHorario.tramosDelDia.mockResolvedValue([]);

      const slots = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        MIERCOLES_FUTURO,
        30
      );

      expect(slots.every((s) => !s.available)).toBe(true);
    });

    // Sin horario configurado no hay nada que hacer cumplir, y restringir
    // dejaría sin agenda a quien no haya pasado por Ajustes.
    it("no restringe nada si el negocio no ha configurado horario", async () => {
      mockHorario.tramosDelDia.mockResolvedValue(null);

      const slots = await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        MIERCOLES_FUTURO,
        30
      );

      expect(slots.some((s) => s.available)).toBe(true);
    });
  });

  describe("estados que ocupan la agenda", () => {
    // Lo que se pinta y lo que se acepta tienen que mirar los mismos estados.
    it("una cita en curso ocupa su franja", async () => {
      mockAvailRepo.find.mockResolvedValue([
        { ...mockAvailability, dayOfWeek: 3 } as unknown as Availability,
      ]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.franjasDeProfesional(
        "business-123",
        "prof-123",
        MIERCOLES_FUTURO,
        30
      );

      const opciones = mockApptRepo.find.mock.calls[0][0];
      const { status } = opciones!.where as {
        status: FindOperator<AppointmentStatus>;
      };
      expect(status.value).toContain(AppointmentStatus.IN_PROGRESS);
    });
  });

  describe("franjaDentroDelHorario", () => {
    it("acepta una franja dentro de la jornada y sin bloqueos", async () => {
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
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
      mockAvailRepo.find.mockResolvedValue([]);

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
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
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
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
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
