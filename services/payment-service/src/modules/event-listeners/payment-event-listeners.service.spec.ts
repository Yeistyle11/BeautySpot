import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import type { IBaseEvent } from "@beautyspot/event-types";
import { PaymentEventListeners } from "./payment-event-listeners.service";

/** Payload base de una cita, reutilizado por los eventos de este listener. */
const baseAppointmentPayload = {
  businessId: "biz-123",
  clientId: "client-123",
  professionalId: "prof-123",
  date: "2026-06-16",
  startTime: "14:00",
  endTime: "15:00",
  totalAmount: 50000,
};

/** Envuelve un payload en la forma de evento del bus para los tests. */
function makeEvent<T>(payload: T): IBaseEvent<T> {
  return {
    eventType: "test.event",
    timestamp: new Date(),
    correlationId: "test-correlation-id",
    payload,
  };
}

describe("PaymentEventListeners", () => {
  let service: PaymentEventListeners;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Espiar los métodos de Logger
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    const module = await Test.createTestingModule({
      providers: [PaymentEventListeners],
    }).compile();

    service = module.get<PaymentEventListeners>(PaymentEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleAppointmentCreated", () => {
    it("debería loggear cita creada y monto pendiente", async () => {
      const event = makeEvent({
        ...baseAppointmentPayload,
        appointmentId: "apt-123",
        totalAmount: 50000,
      });

      await service.handleAppointmentCreated(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita creada: ${event.payload.appointmentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Pendiente de pago para cita apt-123: 50000 COP`
      );
    });
  });

  describe("handleAppointmentConfirmed", () => {
    it("debería loggear cita confirmada", async () => {
      const event = makeEvent({
        ...baseAppointmentPayload,
        appointmentId: "apt-456",
      });

      await service.handleAppointmentConfirmed(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita confirmada: ${event.payload.appointmentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Cita apt-456 confirmada, esperando pago`
      );
    });
  });

  describe("handleAppointmentCompleted", () => {
    it("debería loggear cita completada con pago pendiente", async () => {
      const event = makeEvent({
        ...baseAppointmentPayload,
        appointmentId: "apt-789",
        pointsEarned: 10,
      });

      await service.handleAppointmentCompleted(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita completada: ${event.payload.appointmentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Cita apt-789 completada con pago pendiente`
      );
    });
  });

  describe("handleAppointmentCancelled", () => {
    it("debería loggear cita cancelada con razón", async () => {
      const event = makeEvent({
        ...baseAppointmentPayload,
        appointmentId: "apt-999",
        cancelReason: "Cliente no pudo asistir",
      });

      await service.handleAppointmentCancelled(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita cancelada: ${event.payload.appointmentId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Cita apt-999 cancelada. Razon: Cliente no pudo asistir`
      );
    });
  });
});
