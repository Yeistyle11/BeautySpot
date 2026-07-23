import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DataSource } from "typeorm";
import { AppointmentsService } from "./appointments.service";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { EventBusService } from "@beautyspot/nest-common";

describe("AppointmentsService", () => {
  let service: AppointmentsService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEventBus: any;

  const mockAppointment: Appointment = {
    id: "appt-123",
    businessId: "business-123",
    branchId: "branch-123",
    clientId: "client-123",
    professionalId: "prof-123",
    date: "2024-01-15",
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: 50000,
    status: AppointmentStatus.PENDING,
    pointsEarned: 0,
    notes: "",
    cancelReason: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    appointmentServices: [],
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
    mockApptRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    } as any;

    mockAvailRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
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
            const manager = {
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
            return await callback(manager);
          }
        ),
    } as any;

    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockApptRepo,
        },
        {
          provide: getRepositoryToken(Availability),
          useValue: mockAvailRepo,
        },
        {
          provide: getRepositoryToken(BlockedSlot),
          useValue: mockBlockRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EventBusService,
          useValue: mockEventBus,
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
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 30 },
        ],
        date: "2024-01-15",
        startTime: "10:00",
        notes: "Cliente VIP",
      };

      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      expect(mockAvailRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          professionalId: "prof-123",
          dayOfWeek: 1,
          active: true,
        },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el horario no está disponible", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 30 },
        ],
        date: "2024-01-15",
        startTime: "10:00",
      };

      mockAvailRepo.findOne.mockResolvedValue(null);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar BadRequestException si el slot está fuera del horario de trabajo", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 120 },
        ],
        date: "2024-01-15",
        startTime: "17:30", // Terminaría a las 19:30, fuera del horario 09:00-18:00
      };

      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockApptRepo.find.mockResolvedValue([]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar BadRequestException si hay conflicto con otra cita", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 30 },
        ],
        date: "2024-01-15",
        startTime: "10:00",
      };

      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería calcular el total de duración y monto correctamente", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 30 },
          { id: "service-2", name: "Barba", price: 20000, duration: 15 },
        ],
        date: "2024-01-15",
        startTime: "10:00",
      };

      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it("debería usar transacción SERIALIZABLE para prevenir doble-booking", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 30 },
        ],
        date: "2024-01-15",
        startTime: "10:00",
      };

      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
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
        serviceIds: [
          { id: "service-1", name: "Corte", price: 30000, duration: 30 },
        ],
        date: "2024-01-15",
        startTime: "10:00",
      };

      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
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
      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        { status: AppointmentStatus.CONFIRMED }
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
        { status: AppointmentStatus.IN_PROGRESS }
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
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        { status: AppointmentStatus.COMPLETED, pointsEarned: 5000 }
      );
      expect(mockEventBus.emit).toHaveBeenCalled();
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
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(inProgressAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        expect.objectContaining({ status: AppointmentStatus.COMPLETED })
      );
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
        startTime: `${futureDate.getHours()}:00`,
        generateId: () => {},
      };

      mockApptRepo.findOne.mockResolvedValue(futureAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.cancel(
        "appt-123",
        "business-123",
        "Cambio de planes",
        "user-123"
      );

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        {
          status: AppointmentStatus.CANCELLED,
          cancelReason: "Cambio de planes",
        }
      );
      expect(mockEventBus.emit).toHaveBeenCalled();
    });

    it("debería lanzar ForbiddenException con menos de 2 horas de anticipación", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);

      await expect(
        service.cancel(
          "appt-123",
          "business-123",
          "Cambio de planes",
          "user-123"
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it("debería lanzar BadRequestException si la cita ya está completada", async () => {
      const completedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(completedAppt);

      await expect(
        service.cancel(
          "appt-123",
          "business-123",
          "Cambio de planes",
          "user-123"
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("markNoShow", () => {
    it("debería marcar una cita como no asistida", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.markNoShow("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        { status: AppointmentStatus.NO_SHOW }
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
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
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
        "2024-01-16",
        "15:00",
        60
      );

      // Debe usar tx SERIALIZABLE (prevencion de doble-booking)
      expect(mockDataSource.transaction).toHaveBeenCalledWith(
        "SERIALIZABLE",
        expect.any(Function)
      );
      // El update ocurre dentro de la tx via el manager
      expect(capturedManager.update).toHaveBeenCalledWith(
        Appointment,
        { id: "appt-123", businessId: "business-123" },
        expect.objectContaining({
          date: "2024-01-16",
          startTime: "15:00",
          status: AppointmentStatus.PENDING,
        })
      );
    });

    it("debería lanzar ForbiddenException con menos de 2 horas de anticipación", () => {
      jest.useFakeTimers();
      const now = new Date("2024-01-15T13:30:00"); // 30 minutos antes de la cita
      jest.setSystemTime(now);

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      return expect(
        service.reschedule(
          "appt-123",
          "business-123",
          "2024-01-15",
          "15:00",
          60
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it("debería lanzar BadRequestException si el nuevo horario no está disponible", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reschedule(
          "appt-123",
          "business-123",
          "2024-01-16",
          "15:00",
          60
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("debería lanzar BadRequestException si hay conflicto en el nuevo horario", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2); // 2 días en el futuro para pasar la política de 2 horas

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([
        {
          ...mockAppointment,
          id: "other-appt",
          date: "2024-01-16",
          startTime: "14:30",
          endTime: "15:30",
          generateId: () => "other-id",
        } as any,
      ]);

      await expect(
        service.reschedule(
          "appt-123",
          "business-123",
          "2024-01-16",
          "15:00",
          60
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAvailableSlots", () => {
    it("debería retornar slots disponibles", async () => {
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.findAvailableSlots(
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

      const result = await service.findAvailableSlots(
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

      const result = await service.findAvailableSlots(
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

      const result = await service.findAvailableSlots(
        "business-123",
        "prof-123",
        "2024-01-15",
        30
      );

      const bookedSlot = result.find((s: any) => s.startTime === "10:00");
      expect(bookedSlot?.available).toBe(false);
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
        { date: "2024-01-15" },
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", date: "2024-01-15" },
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
      expect(typeof service.findAvailableSlots).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.findByBusiness).toBe("function");
    });
  });
});
