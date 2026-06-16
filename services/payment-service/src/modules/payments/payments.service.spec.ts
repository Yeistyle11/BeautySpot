import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { PaymentEntity } from './payment.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@beautyspot/shared-types';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EventNames } from '@beautyspot/event-types';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockRepo: jest.Mocked<Repository<PaymentEntity>>;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;

  const mockPayment: PaymentEntity = {
    id: 'payment-123',
    businessId: 'business-123',
    appointmentId: 'appointment-123',
    clientId: 'client-123',
    amount: 100,
    method: PaymentMethod.CASH,
    status: PaymentStatus.COMPLETED,
    reference: 'REF-123',
    notes: 'Pago en efectivo',
    registeredBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as any;

    mockAmqpConnection = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: mockRepo,
        },
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('create', () => {
    it('debería crear un pago exitosamente', async () => {
      const data = {
        clientId: 'client-123',
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: 'user-123',
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockRepo.save.mockResolvedValue(mockPayment);

      const result = await service.create('business-123', data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: 'business-123',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockPayment);
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        EventNames.PAYMENT_PAYMENT_REGISTERED,
        expect.objectContaining({
          eventType: EventNames.PAYMENT_PAYMENT_REGISTERED,
          correlationId: mockPayment.id,
          timestamp: expect.any(Date),
          payload: expect.objectContaining({
            paymentId: mockPayment.id,
            businessId: 'business-123',
            clientId: mockPayment.clientId,
            amount: Number(mockPayment.amount),
            method: mockPayment.method,
          }),
        }),
      );
      expect(result).toEqual(mockPayment);
    });

    it('debería propagar errores del repositorio', async () => {
      const data = {
        clientId: 'client-123',
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: 'user-123',
      };

      mockRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create('business-123', data)).rejects.toThrow();
    });

    it('debería manejar errores de RabbitMQ sin fallar', async () => {
      const data = {
        clientId: 'client-123',
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: 'user-123',
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockRepo.save.mockResolvedValue(mockPayment);
      mockAmqpConnection.publish.mockRejectedValue(new Error('RabbitMQ error'));

      const result = await service.create('business-123', data);

      expect(result).toEqual(mockPayment);
    });
  });

  describe('findByBusiness', () => {
    it('debería retornar pagos del negocio por defecto', async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.findByBusiness('business-123');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockPayment]);
    });

    it('debería filtrar por método', async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      await service.findByBusiness('business-123', { method: PaymentMethod.CASH });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', method: PaymentMethod.CASH },
        order: { createdAt: 'DESC' },
      });
    });

    it('debería filtrar por estado', async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      await service.findByBusiness('business-123', { status: PaymentStatus.COMPLETED });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', status: PaymentStatus.COMPLETED },
        order: { createdAt: 'DESC' },
      });
    });

    it('debería filtrar por rango de fechas', async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      await service.findByBusiness('business-123', { from: '2024-01-01', to: '2024-01-31' });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: 'business-123',
          createdAt: expect.any(Object),
        },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('debería retornar el pago encontrado', async () => {
      mockRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findById('payment-123', 'business-123');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'payment-123', businessId: 'business-123' },
      });
      expect(result).toEqual(mockPayment);
    });

    it('debería lanzar NotFoundException si el pago no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent', 'business-123')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findById('non-existent', 'business-123')).rejects.toThrow(
        'Pago no encontrado'
      );
    });
  });

  describe('updateStatus', () => {
    it('debería actualizar el estado del pago', async () => {
      mockRepo.findOne.mockResolvedValue(mockPayment);
      mockRepo.update.mockResolvedValue({ raw: [], generatedMaps: [], affected: 1 });
      mockRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
        generateId: () => {},
      } as any);

      const result = await service.updateStatus('payment-123', 'business-123', PaymentStatus.REFUNDED);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'payment-123', businessId: 'business-123' },
        { status: PaymentStatus.REFUNDED }
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('debería lanzar NotFoundException si el pago no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', 'business-123', PaymentStatus.REFUNDED)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDailySummary', () => {
    it('debería retornar resumen diario de pagos', async () => {
      const payment1 = { ...mockPayment, method: PaymentMethod.CASH, amount: 50, generateId: () => {} } as any;
      const payment2 = { ...mockPayment, method: PaymentMethod.CARD, amount: 30, generateId: () => {} } as any;
      mockRepo.find.mockResolvedValue([payment1, payment2] as any);

      const result = await service.getDailySummary('business-123', '2024-01-15');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          businessId: 'business-123',
          status: PaymentStatus.COMPLETED,
          createdAt: expect.any(Object),
        }),
      });
      expect(result.date).toBe('2024-01-15');
      expect(result.total).toBe(80);
      expect(result.count).toBe(2);
      expect(result.byMethod).toEqual({
        CASH: 50,
        CARD: 30,
      });
    });

    it('debería retornar resumen vacío si no hay pagos', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getDailySummary('business-123', '2024-01-15');

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.byMethod).toEqual({});
    });
  });

  describe('refundPayment', () => {
    it('debería reembolsar un pago exitosamente', async () => {
      const payment1WeekOld = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(payment1WeekOld);
      mockRepo.save.mockResolvedValue({
        ...payment1WeekOld,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmount: 50,
        refundReason: 'Solicitud del cliente',
        refundedBy: 'SYSTEM',
        generateId: () => {},
      } as any);

      const result = await service.refundPayment(
        'payment-123',
        'business-123',
        'Solicitud del cliente',
        50
      );

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundAmount: 50,
          refundReason: 'Solicitud del cliente',
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        EventNames.PAYMENT_REFUND_PROCESSED,
        expect.objectContaining({
          eventType: EventNames.PAYMENT_REFUND_PROCESSED,
          correlationId: 'payment-123',
          timestamp: expect.any(Date),
          payload: expect.objectContaining({
            paymentId: 'payment-123',
            businessId: 'business-123',
            clientId: payment1WeekOld.clientId,
            originalAmount: Number(payment1WeekOld.amount),
            refundAmount: 50,
            reason: 'Solicitud del cliente',
            refundedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('debería usar monto completo si no se especifica refundAmount', async () => {
      const payment1WeekOld = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(payment1WeekOld);
      mockRepo.save.mockResolvedValue({
        ...payment1WeekOld,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmount: 100,
        refundReason: 'Solicitud del cliente',
        refundedBy: 'SYSTEM',
        generateId: () => {},
      } as any);

      await service.refundPayment('payment-123', 'business-123');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmount: 100,
        })
      );
    });

    it('debería lanzar BadRequestException si el pago no está completado', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING, generateId: () => {} } as any;
      mockRepo.findOne.mockResolvedValue(pendingPayment);

      await expect(
        service.refundPayment('payment-123', 'business-123')
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.refundPayment('payment-123', 'business-123')
      ).rejects.toThrow('Solo se pueden reembolsar pagos completados');
    });

    it('debería lanzar BadRequestException si expiró el periodo de reembolso', async () => {
      const oldPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(oldPayment);

      await expect(
        service.refundPayment('payment-123', 'business-123')
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.refundPayment('payment-123', 'business-123')
      ).rejects.toThrow('El periodo de reembolso de 30 días ha expirado');
    });

    it('debería lanzar BadRequestException si el monto es inválido', async () => {
      const recentPayment = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(recentPayment);

      await expect(
        service.refundPayment('payment-123', 'business-123', '', -1)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.refundPayment('payment-123', 'business-123', '', 200)
      ).rejects.toThrow('El monto del reembolso debe ser mayor a 0 y menor o igual al monto original');
    });

    it('debería manejar errores de RabbitMQ sin fallar', async () => {
      const recentPayment = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(recentPayment);
      mockRepo.save.mockResolvedValue({
        ...recentPayment,
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundedBy: 'SYSTEM',
        generateId: () => {},
      } as any);
      mockAmqpConnection.publish.mockRejectedValue(new Error('RabbitMQ error'));

      await service.refundPayment('payment-123', 'business-123', 'Error', 50);

      expect(mockAmqpConnection.publish).toHaveBeenCalled();
    });
  });
});