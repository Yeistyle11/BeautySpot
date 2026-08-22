import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { OutboxService, ZonaDelNegocioService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { Appointment } from "../../entities/appointment.entity";
import { RemindersWorker } from "./reminders.worker";

describe("RemindersWorker", () => {
  let worker: RemindersWorker;
  let mockQb: Record<string, jest.Mock>;
  let mockManager: { update: jest.Mock };
  let mockOutbox: { enqueue: jest.Mock };

  /**
   * Construye una cita que empieza dentro de `horas` horas, reservada con
   * `antelacion` horas de margen (por defecto, con tiempo de sobra).
   */
  const citaEn = (
    horas: number,
    extra: Partial<Appointment> = {},
    antelacion = 72
  ) => {
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
      createdAt: new Date(inicio.getTime() - antelacion * 3600000),
      reminder24hSentAt: null,
      reminder1hSentAt: null,
      ...extra,
    } as Appointment;
  };

  beforeEach(async () => {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const mockRepo = { createQueryBuilder: jest.fn(() => mockQb) };
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
        {
          provide: ZonaDelNegocioService,
          // La zona del proceso: así `citaEn` puede armar la hora de pared con
          // el reloj local y el worker leerla igual.
          useValue: {
            de: jest
              .fn()
              .mockResolvedValue(
                Intl.DateTimeFormat().resolvedOptions().timeZone
              ),
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    worker = module.get<RemindersWorker>(RemindersWorker);
  });

  it("debería acotar el sondeo a las citas con algún recordatorio pendiente", async () => {
    await worker.poll();

    expect(mockQb.take).toHaveBeenCalledWith(1000);
    expect(mockQb.andWhere).toHaveBeenCalledWith(
      "(cita.reminder24hSentAt IS NULL OR cita.reminder1hSentAt IS NULL)"
    );
  });

  it("debería publicar el recordatorio de 24h y marcar la cita", async () => {
    mockQb.getMany.mockResolvedValue([citaEn(24)]);

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
    mockQb.getMany.mockResolvedValue([citaEn(1)]);

    await worker.poll();

    expect(mockManager.update).toHaveBeenCalledWith(
      Appointment,
      expect.anything(),
      expect.objectContaining({ reminder1hSentAt: expect.any(Date) })
    );
    expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it("recupera el aviso de 24h que se pasó con el worker caído", async () => {
    // A 6 h de la cita el aviso llega tarde, pero llega: antes se perdía.
    mockQb.getMany.mockResolvedValue([citaEn(6)]);

    await worker.poll();

    expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
    expect(mockManager.update).toHaveBeenCalledWith(
      Appointment,
      expect.anything(),
      expect.objectContaining({ reminder24hSentAt: expect.any(Date) })
    );
  });

  it("no debería repetir un recordatorio ya emitido", async () => {
    mockQb.getMany.mockResolvedValue([
      citaEn(24, { reminder24hSentAt: new Date() }),
    ]);

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no avisa todavía de una cita que aún no llega al umbral", async () => {
    mockQb.getMany.mockResolvedValue([citaEn(30)]);

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    expect(mockManager.update).not.toHaveBeenCalled();
  });

  it("descarta sin avisar los recordatorios que ya no aportan", async () => {
    // Media hora antes: el de 24 h lo releva el de 1 h, y el de 1 h sigue vivo.
    mockQb.getMany.mockResolvedValue([citaEn(0.5)]);

    await worker.poll();

    expect(mockManager.update).toHaveBeenCalledTimes(2);
    expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it("cierra los recordatorios de una cita que ya empezó, sin avisar", async () => {
    mockQb.getMany.mockResolvedValue([citaEn(-2)]);

    await worker.poll();

    expect(mockManager.update).toHaveBeenCalledTimes(2);
    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no recuerda una cita reservada cuando el umbral ya había pasado", async () => {
    // Reservada con 3 h de margen: el cliente acaba de elegir esa hora.
    mockQb.getMany.mockResolvedValue([citaEn(2, {}, 3)]);

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("no debería encolar el evento si otra instancia marcó la cita antes", async () => {
    mockQb.getMany.mockResolvedValue([citaEn(24)]);
    mockManager.update.mockResolvedValue({ affected: 0 });

    await worker.poll();

    expect(mockOutbox.enqueue).not.toHaveBeenCalled();
  });

  it("sigue paginando mientras la página venga llena", async () => {
    const llena = Array.from({ length: 1000 }, () => citaEn(30));
    mockQb.getMany.mockResolvedValueOnce(llena).mockResolvedValueOnce([]);

    await worker.poll();

    expect(mockQb.getMany).toHaveBeenCalledTimes(2);
  });

  it("sigue por donde se quedó y no por posición", async () => {
    // Las citas que atiende salen del filtro: avanzar por OFFSET se saltaría
    // tantas como lleve marcadas.
    const llena = Array.from({ length: 1000 }, () => citaEn(30));
    llena[999] = citaEn(30, {
      id: "ultima",
      date: "2026-09-01",
      startTime: "10:30",
    });
    mockQb.getMany.mockResolvedValueOnce(llena).mockResolvedValueOnce([]);

    await worker.poll();

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      "(cita.date, cita.startTime, cita.id) > (:fecha, :hora, :id)",
      { fecha: "2026-09-01", hora: "10:30", id: "ultima" }
    );
  });

  it("no debería solapar dos sondeos", async () => {
    let resolver: (v: unknown) => void = () => {};
    mockQb.getMany.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      })
    );

    const primero = worker.poll();
    await worker.poll();
    expect(mockQb.getMany).toHaveBeenCalledTimes(1);

    resolver([]);
    await primero;
  });
});
