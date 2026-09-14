import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import type { IBaseEvent } from "@beautyspot/event-types";
import {
  ProcessedEventsStore,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { BookingEventListeners } from "./booking-event-listeners.service";
import { AvailabilityService } from "../availability/availability.service";
import { HorarioDelNegocioService } from "../appointments/horario-del-negocio.service";
import { PoliticaDeReservaService } from "../appointments/politica-de-reserva.service";
import { Appointment } from "../../entities/appointment.entity";
import { getRepositoryToken } from "@nestjs/typeorm";

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
  /** Reasignación de citas al fusionar dos fichas. */
  const reasignarCitas = jest.fn().mockResolvedValue({ affected: 3 });
  const mockZonas = { olvidar: jest.fn().mockResolvedValue(undefined) };
  const mockHorarios = { olvidar: jest.fn().mockResolvedValue(undefined) };
  const mockPoliticas = { olvidar: jest.fn().mockResolvedValue(undefined) };

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
          provide: getRepositoryToken(Appointment),
          useValue: { update: reasignarCitas },
        },
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
        { provide: ZonaDelNegocioService, useValue: mockZonas },
        { provide: HorarioDelNegocioService, useValue: mockHorarios },
        { provide: PoliticaDeReservaService, useValue: mockPoliticas },
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

  describe("handleClientMerged", () => {
    // La agenda es lo primero que se mira: si las citas viejas se quedan en la
    // ficha absorbida, el historial de la buena miente por defecto.
    it("las citas de la ficha absorbida pasan a la que sobrevive", async () => {
      await service.handleClientMerged({
        eventId: "evt-fusion",
        payload: {
          businessId: "biz-1",
          supervivienteId: "c-buena",
          absorbidoId: "c-duplicada",
        },
      } as never);

      expect(reasignarCitas).toHaveBeenCalledWith(
        { businessId: "biz-1", clientId: "c-duplicada" },
        { clientId: "c-buena" }
      );
    });
  });

  describe("handleBusinessUpdated", () => {
    // El huso se cachea una hora.
    it("olvida el huso cacheado del negocio que cambió", async () => {
      await service.handleBusinessUpdated(
        makeEvent({ businessId: "negocio-1", slug: "x", changes: {} })
      );

      expect(mockZonas.olvidar).toHaveBeenCalledWith("negocio-1");
    });
  });

  describe("cambios que mueven la apertura", () => {
    // De la apertura salen las horas que se ofrecen: sin olvidarla, cerrar un
    // dia seguia dejando reservar en el hasta que caducara la cache.
    it("olvida la apertura cacheada cuando cambia el horario", async () => {
      await service.handleBusinessHoursUpdated(
        makeEvent({ businessId: "negocio-1" })
      );

      expect(mockHorarios.olvidar).toHaveBeenCalledWith("negocio-1");
    });

    it("olvida la política cacheada cuando cambia la configuración", async () => {
      await service.handleBusinessConfigUpdated(
        makeEvent({ businessId: "negocio-1" })
      );

      expect(mockPoliticas.olvidar).toHaveBeenCalledWith("negocio-1");
    });
  });
});
