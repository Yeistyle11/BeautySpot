import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import type { IBaseEvent } from "@beautyspot/event-types";
import { BookingEventListeners } from "./booking-event-listeners.service";
import { AvailabilityService } from "../availability/availability.service";

/** Envuelve un payload en la forma de evento del bus para los tests. */
function makeEvent<T>(payload: T): IBaseEvent<T> {
  return {
    eventType: "test.event",
    timestamp: new Date(),
    correlationId: "test-correlation-id",
    payload,
  };
}

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
    } as unknown as jest.Mocked<AvailabilityService>;

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
    it("debería loggear el usuario registrado", async () => {
      const event = makeEvent({
        userId: "user-123",
        email: "client@example.com",
        name: "Cliente Ejemplo",
      });

      await service.handleUserRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario registrado: ${event.payload.email}`
      );
    });
  });

  describe("handleBusinessCreated", () => {
    it("debería loggear negocio creado", async () => {
      const event = makeEvent({
        businessId: "biz-123",
        slug: "biz-123",
        name: "Negocio Ejemplo",
        businessType: "salon",
        ownerId: "owner-123",
      });

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
      const event = makeEvent({
        professionalId: "prof-123",
        businessId: "biz-123",
        name: "Profesional Ejemplo",
        specialties: [],
      });

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
      const event = makeEvent({
        professionalId: "prof-456",
        businessId: "biz-456",
        name: "Profesional Ejemplo",
        specialties: [],
      });

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
      const event = makeEvent({
        paymentId: "pay-123",
        businessId: "biz-123",
        clientId: "client-123",
        appointmentId: "apt-123",
        amount: 50000,
        method: "CASH",
      });

      await service.handlePaymentRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Pago registrado: ${event.payload.paymentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Pago vinculado a cita apt-123: 50000 COP (CASH)`
      );
    });

    it("debería loggear pago sin cita", async () => {
      const event = makeEvent({
        paymentId: "pay-456",
        businessId: "biz-123",
        clientId: "client-123",
        amount: 30000,
        method: "CARD",
      });

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
      const event = makeEvent({
        appointmentId: "apt-789",
        businessId: "biz-123",
        clientId: "client-123",
        professionalId: "prof-123",
        date: "2026-06-16",
        startTime: "14:00",
        endTime: "15:00",
        totalAmount: 50000,
      });

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
