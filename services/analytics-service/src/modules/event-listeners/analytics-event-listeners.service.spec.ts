import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AnalyticsEventListeners } from './analytics-event-listeners.service';
import { MetricsService } from '../metrics/metrics.service';

describe('AnalyticsEventListeners', () => {
  let service: AnalyticsEventListeners;
  let mockMetricsService: jest.Mocked<MetricsService>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Espiar los métodos de Logger
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Mock MetricsService
    mockMetricsService = {
      upsertDailyMetric: jest.fn().mockResolvedValue(undefined),
      upsertProfessionalMetric: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsEventListeners,
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsEventListeners>(AnalyticsEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleAppointmentCreated', () => {
    it('debería registrar métricas de cita creada', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-123',
          businessId: 'biz-123',
          totalAmount: 50000,
        },
      };

      await service.handleAppointmentCreated(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita creada: ${event.payload.appointmentId}`);
      expect(mockMetricsService.upsertDailyMetric).toHaveBeenCalledWith({
        businessId: 'biz-123',
        date: expect.any(String),
        totalAppointments: 1,
        totalRevenue: 50000,
      });
    });

    it('debería manejar errores', async () => {
      mockMetricsService.upsertDailyMetric.mockRejectedValue(new Error('Database error'));

      const event = {
        payload: {
          appointmentId: 'apt-456',
          businessId: 'biz-456',
          totalAmount: 30000,
        },
      };

      await service.handleAppointmentCreated(event);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error registrando métricas de cita creada'),
        expect.anything()
      );
    });
  });

  describe('handleAppointmentConfirmed', () => {
    it('debería registrar métricas diarias y de profesional', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-789',
          businessId: 'biz-789',
          professionalId: 'prof-789',
          totalAmount: 60000,
        },
      };

      await service.handleAppointmentConfirmed(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita confirmada: ${event.payload.appointmentId}`);
      expect(mockMetricsService.upsertDailyMetric).toHaveBeenCalledWith({
        businessId: 'biz-789',
        date: expect.any(String),
        totalAppointments: 1,
        completedAppointments: 1,
        totalRevenue: 60000,
      });
      expect(mockMetricsService.upsertProfessionalMetric).toHaveBeenCalledWith({
        businessId: 'biz-789',
        professionalId: 'prof-789',
        date: expect.any(String),
        appointments: 1,
        revenue: 60000,
      });
    });
  });

  describe('handleAppointmentCompleted', () => {
    it('debería registrar métricas de cita completada', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-999',
          businessId: 'biz-999',
          professionalId: 'prof-999',
          totalAmount: 40000,
        },
      };

      await service.handleAppointmentCompleted(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita completada: ${event.payload.appointmentId}`);
      expect(mockMetricsService.upsertDailyMetric).toHaveBeenCalledWith({
        businessId: 'biz-999',
        date: expect.any(String),
        completedAppointments: 1,
        totalRevenue: 40000,
      });
      expect(mockMetricsService.upsertProfessionalMetric).toHaveBeenCalledWith({
        businessId: 'biz-999',
        professionalId: 'prof-999',
        date: expect.any(String),
        appointments: 1,
        revenue: 40000,
      });
    });
  });

  describe('handleAppointmentCancelled', () => {
    it('debería registrar métricas de cita cancelada', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-111',
          businessId: 'biz-111',
          professionalId: 'prof-111',
        },
      };

      await service.handleAppointmentCancelled(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita cancelada: ${event.payload.appointmentId}`);
      expect(mockMetricsService.upsertDailyMetric).toHaveBeenCalledWith({
        businessId: 'biz-111',
        date: expect.any(String),
        cancelledAppointments: 1,
      });
      expect(mockMetricsService.upsertProfessionalMetric).toHaveBeenCalledWith({
        businessId: 'biz-111',
        professionalId: 'prof-111',
        date: expect.any(String),
        appointments: 1,
      });
    });
  });

  describe('handleAppointmentNoShowed', () => {
    it('debería registrar métricas de no-show', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-222',
          businessId: 'biz-222',
          professionalId: 'prof-222',
        },
      };

      await service.handleAppointmentNoShowed(event);

      expect(logSpy).toHaveBeenCalledWith(`No-show: ${event.payload.appointmentId}`);
      expect(mockMetricsService.upsertDailyMetric).toHaveBeenCalledWith({
        businessId: 'biz-222',
        date: expect.any(String),
        noShowAppointments: 1,
      });
      expect(mockMetricsService.upsertProfessionalMetric).toHaveBeenCalledWith({
        businessId: 'biz-222',
        professionalId: 'prof-222',
        date: expect.any(String),
        appointments: 1,
      });
    });
  });

  describe('handlePaymentRegistered', () => {
    it('debería registrar métricas de pago', async () => {
      const event = {
        payload: {
          paymentId: 'pay-123',
          businessId: 'biz-333',
          amount: 75000,
        },
      };

      await service.handlePaymentRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(`Pago registrado: ${event.payload.paymentId}`);
      expect(mockMetricsService.upsertDailyMetric).toHaveBeenCalledWith({
        businessId: 'biz-333',
        date: expect.any(String),
        totalRevenue: 75000,
      });
    });
  });

  describe('handleReviewCreated', () => {
    it('debería registrar métricas de reseña', async () => {
      const event = {
        payload: {
          reviewId: 'rev-123',
          businessId: 'biz-444',
          professionalId: 'prof-444',
          rating: 5,
        },
      };

      await service.handleReviewCreated(event);

      expect(logSpy).toHaveBeenCalledWith(`Reseña creada: ${event.payload.reviewId}`);
      expect(mockMetricsService.upsertProfessionalMetric).toHaveBeenCalledWith({
        businessId: 'biz-444',
        professionalId: 'prof-444',
        date: expect.any(String),
        rating: 5,
      });
    });
  });
});