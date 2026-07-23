import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { BookingEventListeners } from "./booking-event-listeners.service";
import { AvailabilityService } from "../availability/availability.service";

describe("BookingEventListeners", () => {
  let service: BookingEventListeners;
  let mockAvailabilityService: jest.Mocked<AvailabilityService>;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Espiar los métodos de Logger
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    // Mock AvailabilityService
    mockAvailabilityService = {
      replaceWeekly: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        BookingEventListeners,
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
      ],
    }).compile();

    service = module.get<BookingEventListeners>(BookingEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleUserRegistered", () => {
    it("debería loggear usuario registrado como CLIENT", async () => {
      const event = {
        payload: {
          email: "client@example.com",
          role: "CLIENT",
        },
      };

      await service.handleUserRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario registrado: ${event.payload.email}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Cliente registrado en Booking Service: ${event.payload.email}`
      );
    });

    it("debería loggear usuario registrado no CLIENT", async () => {
      const event = {
        payload: {
          email: "admin@example.com",
          role: "ADMIN",
        },
      };

      await service.handleUserRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario registrado: ${event.payload.email}`
      );
      // No debería loggear "Cliente registrado en Booking Service"
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Cliente registrado en Booking Service")
      );
    });
  });

  describe("handleBusinessCreated", () => {
    it("debería loggear negocio creado", async () => {
      const event = {
        payload: {
          businessId: "biz-123",
        },
      };

      await service.handleBusinessCreated(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Negocio creado: ${event.payload.businessId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Negocio ${event.payload.businessId} creado en Booking Service`
      );
    });
  });

  describe("handleProfessionalCreated", () => {
    it("debería crear disponibilidad semanal para profesional", async () => {
      const event = {
        payload: {
          professionalId: "prof-123",
          businessId: "biz-123",
        },
      };

      await service.handleProfessionalCreated(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Profesional creado: ${event.payload.professionalId}`
      );
      expect(mockAvailabilityService.replaceWeekly).toHaveBeenCalledWith(
        "biz-123",
        "prof-123",
        expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: expect.any(Number),
            startTime: "09:00",
            endTime: "18:00",
          }),
        ])
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Disponibilidad semanal creada para profesional prof-123`
      );
    });

    it("debería crear 7 días de disponibilidad", async () => {
      const event = {
        payload: {
          professionalId: "prof-456",
          businessId: "biz-456",
        },
      };

      await service.handleProfessionalCreated(event);

      expect(mockAvailabilityService.replaceWeekly).toHaveBeenCalledWith(
        "biz-456",
        "prof-456",
        expect.arrayContaining([
          expect.objectContaining({ dayOfWeek: 0 }),
          expect.objectContaining({ dayOfWeek: 1 }),
          expect.objectContaining({ dayOfWeek: 2 }),
          expect.objectContaining({ dayOfWeek: 3 }),
          expect.objectContaining({ dayOfWeek: 4 }),
          expect.objectContaining({ dayOfWeek: 5 }),
          expect.objectContaining({ dayOfWeek: 6 }),
        ])
      );
    });
  });

  describe("handlePaymentRegistered", () => {
    it("debería loggear pago vinculado a cita", async () => {
      const event = {
        payload: {
          paymentId: "pay-123",
          appointmentId: "apt-123",
          amount: 50000,
          method: "CASH",
        },
      };

      await service.handlePaymentRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Pago registrado: ${event.payload.paymentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Pago vinculado a cita apt-123: 50000 COP (CASH)`
      );
    });

    it("debería loggear pago sin cita", async () => {
      const event = {
        payload: {
          paymentId: "pay-456",
          amount: 30000,
          method: "CARD",
        },
      };

      await service.handlePaymentRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Pago registrado: ${event.payload.paymentId}`
      );
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("vinculado a cita")
      );
    });
  });

  describe("handleAppointmentReminderDue", () => {
    it("debería loggear recordatorio programado", async () => {
      const event = {
        payload: {
          appointmentId: "apt-789",
          date: "2026-06-16",
          startTime: "14:00",
        },
      };

      await service.handleAppointmentReminderDue(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Recordatorio de cita pendiente: ${event.payload.appointmentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Recordatorio programado para cita apt-789 el 2026-06-16 a las 14:00`
      );
    });
  });
});
