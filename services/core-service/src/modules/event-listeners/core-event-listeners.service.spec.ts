import { Test, TestingModule } from "@nestjs/testing";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { CoreEventListeners } from "./core-event-listeners.service";
import { ClientsService } from "../clients/clients.service";

const CLIENTE = "11111111-1111-4111-8111-111111111111";
const NEGOCIO = "22222222-2222-4222-8222-222222222222";

describe("CoreEventListeners", () => {
  let service: CoreEventListeners;
  let mockClients: { addLoyaltyPoints: jest.Mock };
  let mockProcessedEvents: { once: jest.Mock };
  /** El manager que `once` entrega dentro de su transacción. */
  const manager = { getRepository: jest.fn() };
  /** Registro de los eventos que el store ya dio por procesados. */
  let vistos: Set<string>;

  const citaAtendida = (cambios: Record<string, unknown> = {}) =>
    ({
      eventType: "booking.appointment.completed",
      eventId: "evt-200",
      correlationId: "corr-200",
      timestamp: new Date(),
      payload: {
        appointmentId: "appointment-200",
        clientId: CLIENTE,
        businessId: NEGOCIO,
        professionalId: "professional-200",
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "11:00",
        totalAmount: 50000,
        pointsEarned: 50,
        ...cambios,
      },
    }) as never;

  beforeEach(async () => {
    vistos = new Set();
    mockClients = { addLoyaltyPoints: jest.fn().mockResolvedValue(undefined) };

    // Reproduce el contrato del store real: el trabajo corre una sola vez por
    // (evento, handler) y recibe el manager de la transacción.
    mockProcessedEvents = {
      once: jest.fn(async (evento, handler, trabajo) => {
        const clave = `${evento.eventId}:${handler}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        await trabajo(manager);
        return true;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreEventListeners,
        { provide: ClientsService, useValue: mockClients },
        { provide: ProcessedEventsStore, useValue: mockProcessedEvents },
      ],
    }).compile();

    service = module.get<CoreEventListeners>(CoreEventListeners);
  });

  it("acredita al cliente los puntos que generó la cita", async () => {
    await service.handleAppointmentCompleted(citaAtendida());

    expect(mockClients.addLoyaltyPoints).toHaveBeenCalledWith(
      CLIENTE,
      NEGOCIO,
      50,
      manager
    );
  });

  it("acredita dentro de la transacción de la marca de procesado", async () => {
    await service.handleAppointmentCompleted(citaAtendida());

    // Sin el manager, el incremento se confirmaría por su cuenta y podría
    // quedar sin la marca —o al revés—.
    const [, , , conManager] = mockClients.addLoyaltyPoints.mock.calls[0];
    expect(conManager).toBe(manager);
  });

  it("no acredita dos veces el mismo evento", async () => {
    await service.handleAppointmentCompleted(citaAtendida());
    await service.handleAppointmentCompleted(citaAtendida());

    expect(mockClients.addLoyaltyPoints).toHaveBeenCalledTimes(1);
  });

  it.each([[0], [undefined]])(
    "no toca la ficha si la cita generó %s puntos",
    async (pointsEarned) => {
      await service.handleAppointmentCompleted(citaAtendida({ pointsEarned }));

      expect(mockClients.addLoyaltyPoints).not.toHaveBeenCalled();
      expect(mockProcessedEvents.once).not.toHaveBeenCalled();
    }
  );

  it("propaga el error para que el mensaje llegue a la cola de fallidos", async () => {
    mockClients.addLoyaltyPoints.mockRejectedValue(new Error("Postgres caído"));

    await expect(
      service.handleAppointmentCompleted(citaAtendida())
    ).rejects.toThrow();
  });
});
