import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { Appointment } from "../../entities/appointment.entity";
import { RemindersWorker } from "./reminders.worker";

describe("RemindersWorker", () => {
  let worker: RemindersWorker;
  let mockRepo: { find: jest.Mock };
  let mockManager: { update: jest.Mock };
  let mockOutbox: { enqueue: jest.Mock };

  /** Construye una cita que empieza dentro de `horas` horas. */
  const citaEn = (horas: number, extra: Partial<Appointment> = {}) => {
    const inicio = new Date(Date.now() + horas * 3600000);
    const dosDigitos = (n: number) => `${n}`.padStart(2, "0");
    return {
      id: "appt-123",
      businessId: "business-123",
      clientId: "client-123",
      professionalId: "prof-123",
      date: `${inicio.getFullYear()}-${dosDigitos(inicio.getMonth() + 1)}-${dosDigitos(inicio.getDate())}`,
      startTime: `${dosDigitos(inicio.getHours())}:${dosDigitos(inicio.getMinutes())}`,
      endTime: "23:59",
      totalAmount: 50000,
      status: AppointmentStatus.CONFIRMED,
      reminder24hSentAt: null,
      reminder1hSentAt: null,
      ...extra,
    } as Appointment;
  };

  beforeEach(async () => {
    mockRepo = { find: jest.fn().mockResolvedValue([]) };
    mockManager = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    mockOutbox = { enqueue: jest.fn().mockResolvedValue({}) };

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
      transaction: jest.fn((cb: any) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersWorker,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutbox },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    worker = module.get<RemindersWorker>(RemindersWorker);
  });

  it("debería acotar el sondeo a las citas con algún recordatorio pendiente", async () => {
    await worker.poll();

    const [opciones] = mockRepo.find.mock.calls[0];
    expect(opciones.take).toBe(1000);
    expect(opciones.where).toEqual([
      expect.objectContaining({ reminder24hSentAt: expect.anything() }),
      expect.objectContaining({ reminder1hSentAt: expect.anything() }),
    ]);
  });

  it("debería publicar el recordatorio de 24h y marcar la cita", async () => {
    mockRepo.find.mockResolvedValue([citaEn(24)]);

    await worker.poll();

    expect(mockManager.update).toHaveBeenCalledWith(
      Appointment,
      expect.objectContaining({ id: "appt-123" }),
      expect.objectContaining({ reminder24hSentAt: expect.any(Date) })
    );
    expect(mockOutbox.enqueue).toHaveBeenCalledWith(
      mockManager,
      expect.objectContaining({
        eventType: EventNames.BOOKING_APPOINTMENT_REMINDER_DUE,
        aggregateType: "appointment",
        aggregateId: "appt-123",
        payload: expect.objectContaining({
          appointmentId: "appt-123",
          businessId: "business-123",
          clientId: "client-123",
        }),
      })
    );
  });

  it("debería publicar el recordatorio de 1h", async () => {
    mockRepo.find.mockResolvedValue([citaEn(1)]);

    await worker.poll();

    expect(mockManager.update).toHaveBeenCalledWith(
      Appointment,
      expect.anything(),
      expect.objectContaining({ reminder1hSentAt: expect.any(Date) })
    );
    expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it("no debería repetir un recordatorio ya emitido", async () => {
    mockRepo.find.mockResolvedValue([
      citaEn(24, { reminder24hSentAt: new Date() }),
    ]);

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no debería publicar nada fuera de las ventanas", async () => {
    mockRepo.find.mockResolvedValue([citaEn(6), citaEn(0.1), citaEn(-2)]);

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no debería encolar el evento si otra instancia marcó la cita antes", async () => {
    mockRepo.find.mockResolvedValue([citaEn(24)]);
    mockManager.update.mockResolvedValue({ affected: 0 });

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no debería solapar dos sondeos", async () => {
    let resolver: (v: unknown) => void = () => {};
    mockRepo.find.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      })
    );

    const primero = worker.poll();
    await worker.poll();
    expect(mockRepo.find).toHaveBeenCalledTimes(1);

    resolver([]);
    await primero;
  });
});
