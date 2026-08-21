import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import type { IBaseEvent } from "@beautyspot/event-types";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { BookingEventListeners } from "./booking-event-listeners.service";
import { AvailabilityService } from "../availability/availability.service";

/** Envuelve un payload en la forma de evento del bus para los tests. */
function makeEvent<T>(payload: T): IBaseEvent<T> {
  return {
    eventType: "test.event",
    timestamp: new Date(),
    eventId: "test-evtelation-id",
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
        {
          // El store real se prueba aparte; aquí basta con que deje pasar el
          // trabajo, que es el comportamiento cuando el evento es nuevo.
          provide: ProcessedEventsStore,
          useValue: {
            once: jest.fn(
              async (_e: unknown, _h: string, trabajo: () => Promise<void>) => {
                await trabajo();
                return true;
              }
            ),
          },
        },
      ],
    }).compile();

    service = module.get<BookingEventListeners>(BookingEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    // El fallo se propaga para que el mensaje acabe en la cola de fallidos:
    // darlo por consumido dejaría al profesional sin disponibilidad semanal y
    // sin rastro de que faltó crearla.
    it("registra el error y lo propaga si falla la disponibilidad", async () => {
      const errorSpy = jest.spyOn(Logger.prototype, "error");
      const fallo = new Error("base de datos caída");
      mockAvailabilityService.replaceWeekly.mockRejectedValueOnce(fallo);

      const event = makeEvent({
        professionalId: "prof-789",
        businessId: "biz-789",
        name: "Profesional Ejemplo",
        specialties: [],
      });

      await expect(service.handleProfessionalCreated(event)).rejects.toBe(
        fallo
      );

      expect(errorSpy).toHaveBeenCalledWith(
        "Error creando disponibilidad: base de datos caída",
        fallo.stack
      );
    });

    it("envuelve en Error un rechazo que no lo es, y lo propaga", async () => {
      const errorSpy = jest.spyOn(Logger.prototype, "error");
      mockAvailabilityService.replaceWeekly.mockRejectedValueOnce("boom");

      const event = makeEvent({
        professionalId: "prof-000",
        businessId: "biz-000",
        name: "Profesional Ejemplo",
        specialties: [],
      });

      await expect(service.handleProfessionalCreated(event)).rejects.toThrow(
        "Error desconocido"
      );

      expect(errorSpy).toHaveBeenCalledWith(
        "Error creando disponibilidad: Error desconocido",
        undefined
      );
    });
  });
});
