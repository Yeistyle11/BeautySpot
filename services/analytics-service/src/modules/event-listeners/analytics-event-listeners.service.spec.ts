import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { AnalyticsEventListeners } from "./analytics-event-listeners.service";
import { MetricsService } from "../metrics/metrics.service";

describe("AnalyticsEventListeners", () => {
  let service: AnalyticsEventListeners;
  let mockMetricsService: jest.Mocked<MetricsService>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

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

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsEventListeners,
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<AnalyticsEventListeners>(AnalyticsEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleAppointmentCreated", () => {
    it("debería incrementar totalAppointments y totalRevenue", async () => {
      const event = {
        eventType: "booking.appointment.created",
        timestamp: new Date(),
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
        expect.any(String),
        { totalAppointments: 1, totalRevenue: 50000 }
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
    it("debería incrementar metricas del profesional (appointments + revenue)", async () => {
      const event = {
        eventType: "booking.appointment.confirmed",
        timestamp: new Date(),
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

      expect(
        mockMetricsService.incrementProfessionalMetric
      ).toHaveBeenCalledWith("biz-789", "prof-789", expect.any(String), {
        appointments: 1,
        revenue: 60000,
      });
    });
  });

  describe("handleAppointmentCompleted", () => {
    it("debería incrementar completedAppointments (daily) y appointments+revenue (prof)", async () => {
      const event = {
        eventType: "booking.appointment.completed",
        timestamp: new Date(),
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
        expect.any(String),
        { completedAppointments: 1 }
      );
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).toHaveBeenCalledWith("biz-999", "prof-999", expect.any(String), {
        appointments: 1,
        revenue: 40000,
      });
    });
  });

  describe("handleAppointmentCancelled", () => {
    it("debería incrementar cancelledAppointments (daily) y appointments (prof)", async () => {
      const event = {
        eventType: "booking.appointment.cancelled",
        timestamp: new Date(),
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
        expect.any(String),
        { cancelledAppointments: 1 }
      );
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).toHaveBeenCalledWith("biz-111", "prof-111", expect.any(String), {
        appointments: 1,
      });
    });
  });

  describe("handleAppointmentNoShowed", () => {
    it("debería incrementar noShowAppointments (daily) y appointments (prof)", async () => {
      const event = {
        eventType: "booking.appointment.no-showed",
        timestamp: new Date(),
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
        expect.any(String),
        { noShowAppointments: 1 }
      );
      expect(
        mockMetricsService.incrementProfessionalMetric
      ).toHaveBeenCalledWith("biz-222", "prof-222", expect.any(String), {
        appointments: 1,
      });
    });
  });

  describe("handlePaymentRegistered", () => {
    it("debería incrementar totalRevenue (daily)", async () => {
      const event = {
        eventType: "payment.payment.registered",
        timestamp: new Date(),
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
        { totalRevenue: 75000 }
      );
    });
  });

  describe("handleReviewCreated", () => {
    it("debería setear el rating del profesional (SET absoluto, no increment)", async () => {
      const event = {
        eventType: "marketplace.review.created",
        timestamp: new Date(),
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
        5
      );
    });
  });
});
