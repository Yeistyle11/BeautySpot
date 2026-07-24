import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import type { IBaseEvent } from "@beautyspot/event-types";
import { CoreEventListeners } from "./core-event-listeners.service";

/** Payload base de una cita, reutilizado por los eventos de este listener. */
const baseAppointmentPayload = {
  businessId: "biz-456",
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

describe("CoreEventListeners", () => {
  let service: CoreEventListeners;

  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Espiar los métodos de Logger
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    const module = await Test.createTestingModule({
      providers: [CoreEventListeners],
    }).compile();

    service = module.get<CoreEventListeners>(CoreEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleUserRegistered", () => {
    it("debería loggear usuario registrado", async () => {
      const event = makeEvent({
        userId: "user-123",
        email: "test@example.com",
        name: "Usuario Ejemplo",
      });

      await service.handleUserRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario registrado: ${event.payload.email}`
      );
    });
  });

  describe("handleMembershipCreated", () => {
    it("debería loggear membresía creada", async () => {
      const event = makeEvent({
        membershipId: "mem-123",
        userId: "user-123",
        businessId: "biz-456",
        role: "ADMIN",
      });

      await service.handleMembershipCreated(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Membresia creada: ${event.payload.membershipId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Membresia creada en negocio ${event.payload.businessId} con rol ${event.payload.role}`
      );
    });
  });

  describe("handleMembershipRoleChanged", () => {
    it("debería loggear cambio de rol", async () => {
      const event = makeEvent({
        membershipId: "mem-789",
        userId: "user-123",
        businessId: "biz-456",
        previousRole: "STAFF",
        newRole: "ADMIN",
      });

      await service.handleMembershipRoleChanged(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario cambió de rol ${event.payload.previousRole} a ${event.payload.newRole} en negocio ${event.payload.businessId}`
      );
    });
  });

  describe("handleAppointmentCompleted", () => {
    it("debería loggear cita completada y puntos ganados", async () => {
      const event = makeEvent({
        ...baseAppointmentPayload,
        appointmentId: "apt-123",
        clientId: "client-123",
        pointsEarned: 100,
      });

      await service.handleAppointmentCompleted(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita ${event.payload.appointmentId} completada. Cliente ${event.payload.clientId} ganó ${event.payload.pointsEarned} puntos`
      );
    });
  });

  describe("handleAppointmentCancelled", () => {
    it("debería loggear cita cancelada y razón", async () => {
      const event = makeEvent({
        ...baseAppointmentPayload,
        appointmentId: "apt-456",
        clientId: "client-456",
        cancelReason: "Cliente no pudo asistir",
      });

      await service.handleAppointmentCancelled(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita ${event.payload.appointmentId} cancelada por cliente ${event.payload.clientId}. Razon: ${event.payload.cancelReason}`
      );
    });
  });
});
