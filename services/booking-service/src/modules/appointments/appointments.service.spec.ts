import { Test, TestingModule } from "@nestjs/testing";
import {
  InternalHttpClient,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { HorarioDelNegocioService } from "./horario-del-negocio.service";
import { PoliticaDeReservaService } from "./politica-de-reserva.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { DataSource } from "typeorm";
import { ServiceUnavailableException } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

/** Agendar exige futuro, así que las fechas del fixture se calculan al vuelo. */
function dentroDeDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const SERVICIO_CORTE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FECHA_CITA = dentroDeDias(30);
const FECHA_SIGUIENTE = dentroDeDias(31);
const DIA_DE_LA_SEMANA = new Date(FECHA_CITA + "T12:00:00").getDay();

/**
 * Fecha y hora de una cita inminente, para las reglas de anticipación mínima.
 * El servicio interpreta `${date}T${startTime}` como hora local, así que el
 * fixture se arma con los componentes locales.
 */
function dentroDeMinutos(minutos: number): { date: string; startTime: string } {
  const d = new Date(Date.now() + minutos * 60 * 1000);
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    startTime: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}

describe("AppointmentsService", () => {
  let service: AppointmentsService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockDataSource: jest.Mocked<DataSource>;
  /** Manager que recibió el último callback de `transaction`. */
  let mockManager: { update: jest.Mock; [clave: string]: unknown };
  let mockOutbox: any;
  let mockHttp: { pedir: jest.Mock; enviar: jest.Mock };
  let mockZonas: ZonaDelNegocioService;
  let mockHorarioDelNegocio: HorarioDelNegocioService;
  let mockPolitica: { horasMinimasDeCancelacion: jest.Mock };

  /** Lo que el catálogo del core-service devuelve para el servicio del fixture. */
  const CORTE = {
    id: SERVICIO_CORTE,
    name: "Corte",
    price: 30000,
    duration: 30,
  };

  const mockAppointment: Appointment = {
    id: "appt-123",
    businessId: "business-123",
    branchId: "branch-123",
    clientId: "client-123",
    professionalId: "prof-123",
    date: FECHA_CITA,
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: 50000,
    status: AppointmentStatus.PENDING,
    pointsEarned: 0,
    notes: "",
    cancelReason: "",
    reminder24hSentAt: null,
    reminder1hSentAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Reagendar saca la duración de aquí, así que el fixture la trae: son los
    // 60 minutos que van de las 10:00 a las 11:00.
    appointmentServices: [{ duration: 60 } as never],
    generateId: () => {},
  };

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
    mockApptRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    } as any;

    mockAvailRepo = {
      findOne: jest.fn(),
      // Los horarios se leen con `find`: un día puede tener varios tramos.
      find: jest.fn().mockResolvedValue([]),
    } as any;

    mockBlockRepo = {
      find: jest.fn(),
    } as any;

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (isolationOrCallback: any, maybeCallback?: any) => {
            // Soporta both signatures: transaction(cb) y transaction(isolationLevel, cb)
            const callback =
              typeof isolationOrCallback === "function"
                ? isolationOrCallback
                : maybeCallback;
            // Se guarda fuera para poder comprobar lo que se escribió dentro
            // de la transacción.
            mockManager = {
              create: jest.fn((_, data) => ({
                id: "test-id",
                ...data,
                generateId: () => {},
              })),
              save: jest
                .fn()
                .mockResolvedValue({ id: "test-id", generateId: () => {} }),
              findOne: jest.fn().mockResolvedValue({
                id: "test-id",
                appointmentServices: [],
                generateId: () => {},
              }),
              find: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            };
            return await callback(mockManager);
          }
        ),
    } as any;

    mockOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    mockHttp = {
      pedir: jest.fn().mockResolvedValue([]),
      enviar: jest.fn().mockResolvedValue([CORTE]),
    };

    // El negocio del fixture vive en Bogotá y no tiene horario de apertura
    // configurado, así que la agenda solo la limita el horario del profesional.
    mockZonas = {
      de: jest.fn().mockResolvedValue("America/Bogota"),
    } as never;
    mockHorarioDelNegocio = {
      tramosDelDia: jest.fn().mockResolvedValue(null),
    } as never;
    mockPolitica = {
      horasMinimasDeCancelacion: jest.fn().mockResolvedValue(2),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockApptRepo,
        },
        {
          // Motor real sobre los mismos repositorios simulados: estos tests
          // comprueban el comportamiento de extremo a extremo (horario,
          // bloqueos y conflictos), no que se llame a un colaborador.
          provide: AvailabilityQueryService,
          useFactory: () =>
            new AvailabilityQueryService(
              mockApptRepo,
              mockAvailRepo,
              mockBlockRepo,
              mockZonas,
              mockHorarioDelNegocio
            ),
        },
        { provide: ZonaDelNegocioService, useValue: mockZonas },
        { provide: PoliticaDeReservaService, useValue: mockPolitica },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: OutboxService,
          useValue: mockOutbox,
        },
        {
          provide: InternalHttpClient,
          useValue: mockHttp,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("create", () => {
    it("debería crear una cita exitosamente", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
        notes: "Cliente VIP",
      };

      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      expect(mockAvailRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
          dayOfWeek: DIA_DE_LA_SEMANA,
          active: true,
        },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el horario no está disponible", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue([]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería rechazar una fecha pasada antes de consultar disponibilidad", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: dentroDeDias(-1),
        startTime: "10:00",
      };

      await expect(service.create("business-123", data)).rejects.toThrow(
        "No se puede agendar una cita en el pasado"
      );
      expect(mockAvailRepo.find).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el slot está fuera del horario de trabajo", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "17:30", // Terminaría a las 19:30, fuera del horario 09:00-18:00
      };

      mockHttp.enviar.mockResolvedValue([{ ...CORTE, duration: 120 }]);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockApptRepo.find.mockResolvedValue([]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar BadRequestException si hay conflicto con otra cita", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("calcula la duración y el importe con el catálogo, no con lo que llegue del cliente", async () => {
      const BARBA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE, BARBA],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockHttp.enviar.mockResolvedValue([
        CORTE,
        { id: BARBA, name: "Barba", price: 20000, duration: 15 },
      ]);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/services/resolve",
        {
          businessId: "business-123",
          ids: [SERVICIO_CORTE, BARBA],
          professionalId: "prof-123",
        }
      );
      // 30000 + 20000, y 45 minutos desde las 10:00.
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: expect.objectContaining({
            totalAmount: 50000,
            endTime: "10:45",
          }),
        })
      );
    });

    it("no crea la cita si el catálogo no responde", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockHttp.enviar.mockResolvedValue(null);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("debería usar transacción SERIALIZABLE para prevenir doble-booking", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      // El primer argumento de transaction debe ser el nivel de aislamiento
      expect(mockDataSource.transaction).toHaveBeenCalledWith(
        "SERIALIZABLE",
        expect.any(Function)
      );
    });

    it("debería detectar conflicto dentro de la tx (race condition)", async () => {
      // Simula doble-booking: el pre-check pasa (sin conflicto) pero dentro
      // de la tx SERIALIZABLE aparece una cita conflictiva (otra tx insertó).
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      // Pre-check fuera de la tx: sin conflicto
      mockApptRepo.find.mockResolvedValue([]);

      // Re-check dentro de la tx: aparece cita conflictiva (race)
      const conflictingAppt = {
        ...mockAppointment,
        id: "race-appt",
        startTime: "10:00",
        endTime: "10:30",
        generateId: () => {},
      } as any;
      mockDataSource.transaction.mockImplementationOnce(
        async (isolationOrCb: any, maybeCb?: any) => {
          const cb =
            typeof isolationOrCb === "function" ? isolationOrCb : maybeCb;
          const manager = {
            create: jest.fn((_, d) => ({ id: "test-id", ...d })),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([conflictingAppt]),
            update: jest.fn(),
          };
          return await cb(manager);
        }
      );

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("confirm", () => {
    it("debería confirmar una cita pendiente", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.confirm("appt-123", "business-123");

      expect(mockApptRepo.findOne).toHaveBeenCalledWith({
        where: { id: "appt-123", businessId: "business-123" },
        relations: { appointmentServices: true },
      });
      // El cambio de estado y el evento van en la misma transacción.
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
          aggregateType: "appointment",
          aggregateId: "appt-123",
        })
      );
    });

    it("debería lanzar BadRequestException si la cita no está pendiente", async () => {
      const confirmedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);

      await expect(service.confirm("appt-123", "business-123")).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar NotFoundException si la cita no existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.confirm("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("startService", () => {
    it("debería iniciar una cita confirmada", async () => {
      const confirmedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.startService("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        {
          status: AppointmentStatus.IN_PROGRESS,
          startedAt: expect.any(Date),
        }
      );
    });

    it("no pisa la hora real de inicio al reiniciar una cita", async () => {
      const empezada = new Date("2026-01-01T10:03:00Z");
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
        startedAt: empezada,
        generateId: () => {},
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.startService("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ startedAt: empezada })
      );
    });

    it("debería lanzar BadRequestException si la cita no está confirmada", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);

      await expect(
        service.startService("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("complete", () => {
    it("debería completar una cita y otorgar puntos (10% del monto)", async () => {
      const confirmedAppt = {
        ...mockAppointment,
        // Ya empezada: el servicio rechaza completar lo que aún no ha
        // sucedido.
        ...dentroDeMinutos(-30),
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      // El cambio de estado y el evento se encolan en la misma transacción;
      // el enqueue del outbox captura la intención (con los puntos calculados).
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_COMPLETED,
          aggregateType: "appointment",
          aggregateId: "appt-123",
          payload: expect.objectContaining({ pointsEarned: 5000 }),
        })
      );
    });

    it("guarda la hora real de fin", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...dentroDeMinutos(-30),
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      expect(mockManager.update).toHaveBeenCalledWith(
        Appointment,
        { id: "appt-123", businessId: "business-123" },
        expect.objectContaining({ completedAt: expect.any(Date) })
      );
    });

    it("debería lanzar BadRequestException si la cita no está en estado válido", async () => {
      const cancelledAppt = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(cancelledAppt);

      await expect(
        service.complete("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
    });

    it("debería permitir completar una cita en progreso", async () => {
      const inProgressAppt = {
        ...mockAppointment,
        ...dentroDeMinutos(-30),
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(inProgressAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_COMPLETED,
        })
      );
    });

    // Completar arrastra el cobro: una cita futura daría un ingreso real por
    // un servicio que no se ha prestado.
    it("rechaza completar una cita que aún no ha empezado", async () => {
      const futureAppt = {
        ...mockAppointment,
        ...dentroDeMinutos(120),
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(futureAppt);

      await expect(
        service.complete("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("debería cancelar una cita con política de 2 horas", async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 3);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const futureAppt: any = {
        ...mockAppointment,
        date: futureDateStr,
        // Con ceros a la izquierda: "6:00" no es una hora de pared válida.
        startTime: `${String(futureDate.getHours()).padStart(2, "0")}:00`,
        generateId: () => {},
      };

      mockApptRepo.findOne.mockResolvedValue(futureAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.cancel("appt-123", "business-123", "Cambio de planes");

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_CANCELLED,
          aggregateId: "appt-123",
          payload: expect.objectContaining({
            cancelReason: "Cambio de planes",
          }),
        })
      );
    });

    it("debería lanzar ForbiddenException con menos de 2 horas de anticipación", async () => {
      const inminente = dentroDeMinutos(60);
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...inminente,
      } as any);

      await expect(
        service.cancel("appt-123", "business-123", "Cambio de planes", {
          esCliente: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    // Si el profesional se enferma, el salón tiene que poder vaciar la agenda
    // de las próximas dos horas.
    it("el negocio puede cancelar una cita inminente", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...dentroDeMinutos(60),
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await expect(
        service.cancel("appt-123", "business-123", "Profesional enfermo")
      ).resolves.toBeDefined();
    });

    it("respeta el umbral que configure el negocio", async () => {
      mockPolitica.horasMinimasDeCancelacion.mockResolvedValue(24);
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...dentroDeMinutos(60 * 5),
      } as any);

      await expect(
        service.cancel("appt-123", "business-123", "Cambio de planes", {
          esCliente: true,
        })
      ).rejects.toThrow(/24 horas/);
    });

    it("debería lanzar BadRequestException si la cita ya está completada", async () => {
      const completedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(completedAppt);

      await expect(
        service.cancel("appt-123", "business-123", "Cambio de planes")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("markNoShow", () => {
    it("debería marcar una cita como no asistida", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.markNoShow("appt-123", "business-123");

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_NO_SHOWED,
          aggregateType: "appointment",
          aggregateId: "appt-123",
        })
      );
    });

    it("debería lanzar BadRequestException si la cita está en progreso", async () => {
      const inProgressAppt = {
        ...mockAppointment,
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(inProgressAppt);

      await expect(
        service.markNoShow("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("reschedule", () => {
    beforeEach(() => {
      jest
        .useFakeTimers()
        .setSystemTime(new Date("2024-01-15T08:00:00").getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });
    it("debería reagendar una cita correctamente dentro de tx SERIALIZABLE", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const futureAppt: any = {
        ...mockAppointment,
        date: futureDateStr,
        startTime: "14:00",
        generateId: () => {},
      };

      mockApptRepo.findOne.mockResolvedValue(futureAppt);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      // Capturar el manager para verificar el update dentro de la tx
      let capturedManager: any;
      mockDataSource.transaction.mockImplementationOnce(
        async (isolationOrCb: any, maybeCb?: any) => {
          const cb =
            typeof isolationOrCb === "function" ? isolationOrCb : maybeCb;
          const manager = {
            create: jest.fn((_, d) => ({ id: "test-id", ...d })),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
          capturedManager = manager;
          return await cb(manager);
        }
      );

      await service.reschedule(
        "appt-123",
        "business-123",
        FECHA_SIGUIENTE,
        "15:00"
      );

      // Debe usar tx SERIALIZABLE (prevencion de doble-booking)
      expect(mockDataSource.transaction).toHaveBeenCalledWith(
        "SERIALIZABLE",
        expect.any(Function)
      );
      // El update ocurre dentro de la tx via el manager, con la duración real
      // de los servicios de la cita (60 min) y sin tocar el estado.
      expect(capturedManager.update).toHaveBeenCalledWith(
        Appointment,
        { id: "appt-123", businessId: "business-123" },
        {
          date: FECHA_SIGUIENTE,
          startTime: "15:00",
          endTime: "16:00",
        }
      );
    });

    it("conserva la duración de los servicios en vez de asumir 30 minutos", async () => {
      const largo: any = {
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        startTime: "14:00",
        endTime: "15:30",
        appointmentServices: [{ duration: 60 }, { duration: 30 }],
      };

      mockApptRepo.findOne.mockResolvedValue(largo);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      let capturedManager: any;
      mockDataSource.transaction.mockImplementationOnce(
        async (isolationOrCb: any, maybeCb?: any) => {
          const cb =
            typeof isolationOrCb === "function" ? isolationOrCb : maybeCb;
          capturedManager = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
          return await cb(capturedManager);
        }
      );

      await service.reschedule(
        "appt-123",
        "business-123",
        FECHA_SIGUIENTE,
        "10:00"
      );

      expect(capturedManager.update).toHaveBeenCalledWith(
        Appointment,
        expect.anything(),
        expect.objectContaining({ endTime: "11:30" })
      );
    });

    it.each([
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.IN_PROGRESS,
    ])("no deja reagendar una cita en estado %s", async (status) => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        status,
      } as any);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("emite el evento de reagendado con la fecha anterior", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        startTime: "14:00",
      } as any);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.reschedule(
        "appt-123",
        "business-123",
        FECHA_SIGUIENTE,
        "10:00"
      );

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_RESCHEDULED,
          payload: expect.objectContaining({
            startTime: "10:00",
            previousStartTime: "14:00",
          }),
        })
      );
    });

    it("rechaza una cita sin servicios, en vez de darle una duración inventada", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        appointmentServices: [],
      } as any);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
    });

    it("debería lanzar ForbiddenException con menos de 2 horas de anticipación", () => {
      jest.useFakeTimers();
      // La cita del fixture es a las 10:00; nos situamos 30 minutos antes.
      jest.setSystemTime(new Date(`${FECHA_CITA}T09:30:00`));

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      return expect(
        service.reschedule("appt-123", "business-123", FECHA_CITA, "15:00", {
          esCliente: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("el negocio puede reagendar una cita inminente", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(`${FECHA_CITA}T09:30:00`));

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_CITA, "15:00")
      ).resolves.toBeDefined();
    });

    it("debería lanzar BadRequestException si el nuevo horario no está disponible", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue([]);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
    });

    it("debería lanzar BadRequestException si hay conflicto en el nuevo horario", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2); // 2 días en el futuro para pasar la política de 2 horas

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue([mockAvailability]);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([
        {
          ...mockAppointment,
          id: "other-appt",
          date: FECHA_SIGUIENTE,
          startTime: "14:30",
          endTime: "15:30",
          generateId: () => "other-id",
        } as any,
      ]);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("debería retornar la cita cuando existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);

      const result = await service.findById("appt-123", "business-123");

      expect(mockApptRepo.findOne).toHaveBeenCalledWith({
        where: { id: "appt-123", businessId: "business-123" },
        relations: { appointmentServices: true },
      });
      expect(result).toEqual(mockAppointment);
    });

    it("debería lanzar NotFoundException cuando la cita no existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByClientUser", () => {
    const pagination = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "date",
      order: "DESC" as const,
    };

    afterEach(() => {
      delete (global as { fetch?: unknown }).fetch;
    });

    /** Fichas que core devuelve para el usuario consultado. */
    function coreDevuelve(clients: { id: string }[]) {
      mockHttp.pedir.mockResolvedValue(clients);
    }

    it("busca las citas de todas las fichas del usuario", async () => {
      coreDevuelve([{ id: "cliente-a" }, { id: "cliente-b" }]);
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      const result = await service.findByClientUser("user-1", pagination);

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: In(["cliente-a", "cliente-b"]) },
        })
      );
      expect(result.data).toEqual([mockAppointment]);
    });

    it("nunca consulta sin filtro cuando el usuario no tiene fichas", async () => {
      coreDevuelve([]);

      const result = await service.findByClientUser(
        "user-sin-fichas",
        pagination
      );

      expect(mockApptRepo.findAndCount).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it("avisa si core no responde, en vez de devolver una lista vacía", async () => {
      mockHttp.pedir.mockRejectedValue(
        new ServiceUnavailableException("core-service no está disponible")
      );

      await expect(
        service.findByClientUser("user-1", pagination)
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe("findByIdForClientUser", () => {
    it("devuelve la cita cuando es de una ficha del usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockHttp.pedir.mockResolvedValue([{ id: "client-123" }]);

      const result = await service.findByIdForClientUser("appt-123", "user-1");

      expect(result).toEqual(mockAppointment);
    });

    it("responde 404 si la cita es de otro cliente, sin revelar que existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockHttp.pedir.mockResolvedValue([{ id: "otra-ficha" }]);

      await expect(
        service.findByIdForClientUser("appt-123", "user-2")
      ).rejects.toThrow(NotFoundException);
    });

    it("responde 404 si la cita no existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdForClientUser("no-existe", "user-1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("datosDeCobro", () => {
    it("devuelve el importe, el estado y el cliente de la cita", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);

      await expect(
        service.datosDeCobro("appt-123", "business-123")
      ).resolves.toEqual({
        clientId: "client-123",
        totalAmount: 50000,
        status: AppointmentStatus.PENDING,
      });
    });

    it("devuelve null para una cita de otro negocio", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.datosDeCobro("appt-123", "business-123")
      ).resolves.toBeNull();
      expect(mockApptRepo.findOne).toHaveBeenCalledWith({
        where: { id: "appt-123", businessId: "business-123" },
      });
    });
  });

  describe("citaReseñablePor", () => {
    const completada: Appointment = {
      ...mockAppointment,
      clientId: "ficha-a",
      professionalId: "prof-123",
      status: AppointmentStatus.COMPLETED,
      appointmentServices: [{ serviceName: "Corte" } as never],
      generateId: () => {},
    };

    it("acepta una cita completada del propio usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-a" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toMatchObject({ resenable: true });
    });

    // El marketplace los usa para no fiarse de lo que el autor escriba en el
    // cuerpo de la reseña.
    it("devuelve el profesional y los servicios atendidos", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-a" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({
        resenable: true,
        professionalId: "prof-123",
        servicios: ["Corte"],
      });
    });

    it("no filtra el profesional de una cita que no es del usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-de-otro" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
    });

    it("rechaza una cita de otro usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-de-otro" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
    });

    it("rechaza una cita que aún no se ha atendido", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...completada,
        status: AppointmentStatus.CONFIRMED,
      } as Appointment);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
    });

    it("rechaza una cita inexistente o de otro negocio", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.citaReseñablePor("inventada", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
      // La búsqueda va acotada al negocio que dice la reseña.
      expect(mockApptRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inventada", businessId: "business-123" },
        })
      );
    });
  });

  describe("findByBusiness", () => {
    const pagination = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "date",
      order: "DESC" as const,
    };

    it("devuelve una página con data + meta (ordenada por fecha y hora)", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      const result = await service.findByBusiness(
        "business-123",
        {},
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123" },
          relations: ["appointmentServices"],
          order: { date: "DESC", startTime: "ASC" },
          skip: 0,
          take: 20,
        })
      );
      expect(result.data).toEqual([mockAppointment]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("calcula los metadatos de paginación en page 2 limit 10", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[], 15]);

      const result = await service.findByBusiness(
        "business-123",
        {},
        { page: 2, limit: 10, offset: 10, sort: "date", order: "DESC" }
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(15);
      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(true);
    });

    it("debería filtrar por status con paginación", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      await service.findByBusiness(
        "business-123",
        { status: AppointmentStatus.CONFIRMED },
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: "business-123",
            status: AppointmentStatus.CONFIRMED,
          },
        })
      );
    });

    it("debería filtrar por fecha con paginación", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      await service.findByBusiness(
        "business-123",
        { date: FECHA_CITA },
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", date: FECHA_CITA },
        })
      );
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(AppointmentsService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.create).toBe("function");
      expect(typeof service.confirm).toBe("function");
      expect(typeof service.startService).toBe("function");
      expect(typeof service.complete).toBe("function");
      expect(typeof service.cancel).toBe("function");
      expect(typeof service.markNoShow).toBe("function");
      expect(typeof service.reschedule).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.findByBusiness).toBe("function");
    });
  });
});
