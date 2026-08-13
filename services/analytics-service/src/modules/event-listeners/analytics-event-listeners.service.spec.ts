import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import {
  ProcessedEventsStore,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { EntityManager } from "typeorm";
import { AnalyticsEventListeners } from "./analytics-event-listeners.service";
import { MetricsService } from "../metrics/metrics.service";
import { NegocioMetricsService } from "../metrics/negocio-metrics.service";

describe("AnalyticsEventListeners", () => {
  let service: AnalyticsEventListeners;
  let mockMetricsService: jest.Mocked<MetricsService>;
  let mockNegocioMetrics: jest.Mocked<NegocioMetricsService>;
  let mockProcessedEvents: jest.Mocked<ProcessedEventsStore>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  /** EntityManager de mentira: aquí sólo se comprueba que llega hasta el servicio. */
  const managerFalso = {} as EntityManager;

  beforeEach(async () => {
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    mockMetricsService = {
      incrementDailyMetric: jest.fn().mockResolvedValue(undefined),
      incrementProfessionalMetric: jest.fn().mockResolvedValue(undefined),
      setProfessionalRating: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockNegocioMetrics = {
      registrarVisita: jest.fn().mockResolvedValue("nueva"),
      registrarServicios: jest.fn().mockResolvedValue(undefined),
      registrarMinutosVendidos: jest.fn().mockResolvedValue(undefined),
      fijarCapacidadDelDia: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Por defecto el evento es nuevo: se ejecuta el trabajo y se da por aplicado.
    mockProcessedEvents = {
      once: jest
        .fn()
        .mockImplementation(
          async (
            _evento: unknown,
            _handler: string,
            trabajo: (m: EntityManager) => Promise<void>
          ) => {
            await trabajo(managerFalso);
            return true;
          }
        ),
    } as unknown as jest.Mocked<ProcessedEventsStore>;

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsEventListeners,
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: NegocioMetricsService, useValue: mockNegocioMetrics },
        { provide: ProcessedEventsStore, useValue: mockProcessedEvents },
        // El negocio de la prueba vive en Bogotá; aquí se comprueba qué métrica
        // se mueve, no en qué huso se lee la fecha.
        {
          provide: ZonaDelNegocioService,
          useValue: { de: jest.fn().mockResolvedValue("America/Bogota") },
        },
      ],
    }).compile();

    service = module.get<AnalyticsEventListeners>(AnalyticsEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleAppointmentCreated", () => {
    it("cuenta la cita en la fecha de la cita, sin tocar los ingresos", async () => {
      const event = {
        eventType: "booking.appointment.created",
        timestamp: new Date(),
        eventId: "evt-1",
        correlationId: "corr-1",
        payload: {
          appointmentId: "apt-123",
          businessId: "biz-123",
          professionalId: "prof-123",
          clientId: "client-123",
          date: "2024-12-25",
          startTime: "10:00",
          endTime: "11:00",
          totalAmount: 50000,
        },
      } as any;

      await service.handleAppointmentCreated(event);

      expect(logSpy).toHaveBeenCalledWith("Cita creada: apt-123");
      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-123",
        "2024-12-25",
        { totalAppointments: 1 },
        managerFalso
      );
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).toHaveBeenCalledWith(
        "biz-123",
        "prof-123",
        "2024-12-25",
        { appointments: 1 },
        managerFalso
      );
    });

    // El importe de una cita es una previsión: sumarlo aquí y otra vez al
    // registrar el pago deja el KPI por encima de lo cobrado.
    it("no suma el importe de la cita a los ingresos", async () => {
      const event = {
        eventType: "booking.appointment.created",
        eventId: "evt-1b",
        payload: {
          appointmentId: "apt-124",
          businessId: "biz-124",
          professionalId: "prof-124",
          date: "2024-12-25",
          totalAmount: 50000,
        },
      } as any;

      await service.handleAppointmentCreated(event);

      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-124",
        "2024-12-25",
        expect.not.objectContaining({ totalRevenue: expect.anything() }),
        managerFalso
      );
    });

    it("debería manejar errores sin lanzar excepción", async () => {
      mockMetricsService.incrementDailyMetric.mockRejectedValue(
        new Error("DB error")
      );

      await service.handleAppointmentCreated({
        payload: {
          appointmentId: "apt-456",
          businessId: "biz-456",
          totalAmount: 30000,
        },
      } as any);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("cita creada"),
        expect.anything()
      );
    });
  });

  describe("handleAppointmentConfirmed", () => {
    // La cita se cuenta al crearse y el ingreso al cobrar: sumar aquí
    // duplicaría ambos en las métricas del profesional.
    it("no mueve ninguna métrica", async () => {
      const event = {
        eventType: "booking.appointment.confirmed",
        timestamp: new Date(),
        eventId: "evt-2",
        correlationId: "corr-2",
        payload: {
          appointmentId: "apt-789",
          businessId: "biz-789",
          professionalId: "prof-789",
          clientId: "client-789",
          date: "2024-12-25",
          startTime: "10:00",
          endTime: "11:00",
          totalAmount: 60000,
        },
      } as any;

      await service.handleAppointmentConfirmed(event);

      expect(mockMetricsService.incrementDailyMetric).not.toHaveBeenCalled();
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).not.toHaveBeenCalled();
    });
  });

  /** Evento de cita completada, con o sin el reparto por servicio. */
  const citaCompletada = (services?: unknown[]) =>
    ({
      eventType: "booking.appointment.completed",
      timestamp: new Date(),
      eventId: "evt-3",
      correlationId: "corr-3",
      payload: {
        appointmentId: "apt-999",
        businessId: "biz-999",
        professionalId: "prof-999",
        clientId: "client-999",
        date: "2024-12-25",
        startTime: "10:00",
        endTime: "11:00",
        totalAmount: 40000,
        pointsEarned: 4000,
        ...(services ? { services } : {}),
      },
    }) as any;

  describe("handleAppointmentCompleted", () => {
    it("cuenta la cita completada y anota el ingreso al profesional", async () => {
      const event = {
        eventType: "booking.appointment.completed",
        timestamp: new Date(),
        eventId: "evt-3",
        correlationId: "corr-3",
        payload: {
          appointmentId: "apt-999",
          businessId: "biz-999",
          professionalId: "prof-999",
          clientId: "client-999",
          date: "2024-12-25",
          startTime: "10:00",
          endTime: "11:00",
          totalAmount: 40000,
          pointsEarned: 4000,
        },
      } as any;

      await service.handleAppointmentCompleted(event);

      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-999",
        "2024-12-25",
        { completedAppointments: 1 },
        managerFalso
      );
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).toHaveBeenCalledWith(
        "biz-999",
        "prof-999",
        "2024-12-25",
        { revenue: 40000 },
        managerFalso
      );
    });

    it("cuenta como nuevo al cliente en su primera visita", async () => {
      mockNegocioMetrics.registrarVisita.mockResolvedValue("nueva");

      await service.handleAppointmentCompleted(citaCompletada());

      expect(mockNegocioMetrics.registrarVisita).toHaveBeenCalledWith(
        "biz-999",
        "client-999",
        "2024-12-25",
        40000,
        managerFalso
      );
      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-999",
        "2024-12-25",
        { newClients: 1 },
        managerFalso
      );
    });

    it("cuenta como recurrente al cliente que vuelve", async () => {
      mockNegocioMetrics.registrarVisita.mockResolvedValue("recurrente");

      await service.handleAppointmentCompleted(citaCompletada());

      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-999",
        "2024-12-25",
        { returningClients: 1 },
        managerFalso
      );
    });

    it("anota los servicios atendidos y sus minutos", async () => {
      await service.handleAppointmentCompleted(
        citaCompletada([
          { serviceId: "svc-1", name: "Corte", price: 30000, duration: 30 },
          { serviceId: "svc-2", name: "Barba", price: 10000, duration: 20 },
        ])
      );

      expect(mockNegocioMetrics.registrarServicios).toHaveBeenCalledWith(
        "biz-999",
        "2024-12-25",
        expect.arrayContaining([
          expect.objectContaining({ serviceId: "svc-1" }),
          expect.objectContaining({ serviceId: "svc-2" }),
        ]),
        managerFalso
      );
      expect(mockNegocioMetrics.registrarMinutosVendidos).toHaveBeenCalledWith(
        "biz-999",
        "prof-999",
        "2024-12-25",
        50,
        managerFalso
      );
    });

    it("un evento sin servicios no rompe el listener", async () => {
      await expect(
        service.handleAppointmentCompleted(citaCompletada())
      ).resolves.toBeUndefined();

      expect(mockNegocioMetrics.registrarServicios).not.toHaveBeenCalled();
      expect(
        mockNegocioMetrics.registrarMinutosVendidos
      ).not.toHaveBeenCalled();
    });
  });

  describe("handleAppointmentCancelled", () => {
    it("cuenta la cancelación en la fecha de la cita", async () => {
      const event = {
        eventType: "booking.appointment.cancelled",
        timestamp: new Date(),
        eventId: "evt-4",
        correlationId: "corr-4",
        payload: {
          appointmentId: "apt-111",
          businessId: "biz-111",
          professionalId: "prof-111",
          clientId: "client-111",
          date: "2024-12-25",
          startTime: "10:00",
          endTime: "11:00",
          totalAmount: 0,
          cancelReason: "No show",
        },
      } as any;

      await service.handleAppointmentCancelled(event);

      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-111",
        "2024-12-25",
        { cancelledAppointments: 1 },
        managerFalso
      );
      // La cita del profesional ya se contó al crearse.
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).not.toHaveBeenCalled();
    });
  });

  describe("handleAppointmentNoShowed", () => {
    it("cuenta el no-show en la fecha de la cita", async () => {
      const event = {
        eventType: "booking.appointment.no-showed",
        timestamp: new Date(),
        eventId: "evt-5",
        correlationId: "corr-5",
        payload: {
          appointmentId: "apt-222",
          businessId: "biz-222",
          professionalId: "prof-222",
          clientId: "client-222",
          date: "2024-12-25",
          startTime: "10:00",
          endTime: "11:00",
          totalAmount: 0,
        },
      } as any;

      await service.handleAppointmentNoShowed(event);

      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-222",
        "2024-12-25",
        { noShowAppointments: 1 },
        managerFalso
      );
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).not.toHaveBeenCalled();
    });
  });

  describe("handleClientCreated", () => {
    it("el alta de ficha no mueve ninguna métrica", async () => {
      const event = {
        eventType: "core.client.created",
        eventId: "evt-7",
        payload: { clientId: "cli-1", businessId: "biz-333", name: "Ana" },
      } as any;

      await service.handleClientCreated(event);

      expect(mockMetricsService.incrementDailyMetric).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentRegistered", () => {
    it("debería incrementar totalRevenue (daily)", async () => {
      const event = {
        eventType: "payment.payment.registered",
        timestamp: new Date(),
        eventId: "evt-6",
        correlationId: "corr-6",
        payload: {
          paymentId: "pay-123",
          businessId: "biz-333",
          clientId: "client-333",
          amount: 75000,
          method: "card",
        },
      } as any;

      await service.handlePaymentRegistered(event);

      expect(mockMetricsService.incrementDailyMetric).toHaveBeenCalledWith(
        "biz-333",
        expect.any(String),
        { totalRevenue: 75000 },
        managerFalso
      );
    });
  });

  describe("handleReviewCreated", () => {
    it("debería setear el rating del profesional (SET absoluto, no increment)", async () => {
      const event = {
        eventType: "marketplace.review.created",
        timestamp: new Date(),
        eventId: "evt-7",
        correlationId: "corr-7",
        payload: {
          reviewId: "rev-123",
          businessId: "biz-444",
          professionalId: "prof-444",
          clientId: "client-444",
          rating: 5,
        },
      } as any;

      await service.handleReviewCreated(event);

      expect(mockMetricsService.setProfessionalRating).toHaveBeenCalledWith(
        "biz-444",
        "prof-444",
        expect.any(String),
        5,
        managerFalso
      );
    });
  });
});
