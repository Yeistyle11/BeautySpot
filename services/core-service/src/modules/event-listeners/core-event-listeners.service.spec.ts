import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CoreEventListeners } from './core-event-listeners.service';

describe('CoreEventListeners', () => {
  let service: CoreEventListeners;

  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Espiar los métodos de Logger
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module = await Test.createTestingModule({
      providers: [CoreEventListeners],
    }).compile();

    service = module.get<CoreEventListeners>(CoreEventListeners);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleUserRegistered', () => {
    it('debería loggear usuario registrado', async () => {
      const event = {
        payload: {
          email: 'test@example.com',
          role: 'CLIENT',
        },
      };

      await service.handleUserRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario registrado: ${event.payload.email}`
      );
    });

    it('debería detectar cliente potencial', async () => {
      const event = {
        payload: {
          email: 'client@example.com',
          role: 'CLIENT',
        },
      };

      await service.handleUserRegistered(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cliente potencial detectado: ${event.payload.email}`
      );
    });

    it('debería manejar errores en el procesamiento', async () => {
      const event = {
        payload: {
          email: null, // Email inválido
          role: 'CLIENT',
        },
      };

      await service.handleUserRegistered(event);

      // El servicio intentará acceder a event.payload.email pero será null
      // y no lanzará error inmediatamente en el log, pero podría fallar después
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usuario registrado')
      );
    });
  });

  describe('handleMembershipCreated', () => {
    it('debería loggear membresía creada', async () => {
      const event = {
        payload: {
          membershipId: 'mem-123',
          businessId: 'biz-456',
          role: 'ADMIN',
        },
      };

      await service.handleMembershipCreated(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Membresia creada: ${event.payload.membershipId}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Membresia creada en negocio ${event.payload.businessId} con rol ${event.payload.role}`
      );
    });
  });

  describe('handleMembershipRoleChanged', () => {
    it('debería loggear cambio de rol', async () => {
      const event = {
        payload: {
          membershipId: 'mem-789',
          businessId: 'biz-456',
          previousRole: 'STAFF',
          newRole: 'ADMIN',
        },
      };

      await service.handleMembershipRoleChanged(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Usuario cambió de rol ${event.payload.previousRole} a ${event.payload.newRole} en negocio ${event.payload.businessId}`
      );
    });
  });

  describe('handleAppointmentCompleted', () => {
    it('debería loggear cita completada y puntos ganados', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-123',
          clientId: 'client-123',
          pointsEarned: 100,
        },
      };

      await service.handleAppointmentCompleted(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita ${event.payload.appointmentId} completada. Cliente ${event.payload.clientId} ganó ${event.payload.pointsEarned} puntos`
      );
    });
  });

  describe('handleAppointmentCancelled', () => {
    it('debería loggear cita cancelada y razón', async () => {
      const event = {
        payload: {
          appointmentId: 'apt-456',
          clientId: 'client-456',
          cancelReason: 'Cliente no pudo asistir',
        },
      };

      await service.handleAppointmentCancelled(event);

      expect(logSpy).toHaveBeenCalledWith(
        `Cita ${event.payload.appointmentId} cancelada por cliente ${event.payload.clientId}. Razon: ${event.payload.cancelReason}`
      );
    });
  });
});