import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PaymentEventListeners } from './payment-event-listeners.service';

describe('PaymentEventListeners', () => {
  let service: PaymentEventListeners;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Espiar los métodos de Logger
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module = await Test.createTestingModule({
      providers: [PaymentEventListeners],
    }).compile();

    service = module.get<PaymentEventListeners>(PaymentEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleAppointmentCreated', () => {
    it('debería loggear cita creada y monto pendiente', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-123',
          totalAmount: 50000,
        },
      };

      await service.handleAppointmentCreated(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita creada: ${event.payload.appointmentId}`);
      expect(logSpy).toHaveBeenCalledWith(`Pendiente de pago para cita apt-123: 50000 COP`);
    });
  });

  describe('handleAppointmentConfirmed', () => {
    it('debería loggear cita confirmada', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-456',
        },
      };

      await service.handleAppointmentConfirmed(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita confirmada: ${event.payload.appointmentId}`);
      expect(logSpy).toHaveBeenCalledWith(`Cita apt-456 confirmada, esperando pago`);
    });
  });

  describe('handleAppointmentCompleted', () => {
    it('debería loggear cita completada con pago pendiente', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-789',
        },
      };

      await service.handleAppointmentCompleted(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita completada: ${event.payload.appointmentId}`);
      expect(logSpy).toHaveBeenCalledWith(`Cita apt-789 completada con pago pendiente`);
    });
  });

  describe('handleAppointmentCancelled', () => {
    it('debería loggear cita cancelada con razón', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-999',
          cancelReason: 'Cliente no pudo asistir',
        },
      };

      await service.handleAppointmentCancelled(event);

      expect(logSpy).toHaveBeenCalledWith(`Cita cancelada: ${event.payload.appointmentId}`);
      expect(logSpy).toHaveBeenCalledWith(`Cita apt-999 cancelada. Razon: Cliente no pudo asistir`);
    });
  });
});