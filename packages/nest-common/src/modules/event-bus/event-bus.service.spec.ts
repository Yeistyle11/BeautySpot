import { EventBusService } from './event-bus.service';
import { ConfigService } from '@nestjs/config';
import { IBaseEvent } from '@beautyspot/event-types';

describe('EventBusService', () => {
  let service: EventBusService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockConnection: any;
  let mockChannel: any;
  let mockAmqp: any;

  beforeEach(async () => {
    mockChannel = {
      publish: jest.fn().mockResolvedValue(undefined),
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockAmqp = {
      default: {
        connect: jest.fn().mockResolvedValue(mockConnection),
      },
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'RABBITMQ_URL') return 'amqp://localhost:5672';
        return undefined;
      }),
    } as any;

    service = new EventBusService(mockConfigService);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    (global as any).amqplib = mockAmqp;
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('debería crear el servicio correctamente', () => {
      expect(service).toBeInstanceOf(EventBusService);
    });

    it('debería iniciar conexión en el constructor', () => {
      expect(mockAmqp.default.connect).toHaveBeenCalledWith('amqp://localhost:5672');
    });
  });

  describe('emit', () => {
    it('debería emitir evento correctamente', async () => {
      const payload = { appointmentId: '123', customer: 'John' };
      
      await service.emit('appointment.created', payload);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        'appointment.created',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          deliveryMode: 2,
          expiration: '300000',
          messageId: expect.any(String),
        }),
      );
    });

    it('debería crear mensaje con estructura correcta', async () => {
      const payload = { appointmentId: '123' };
      
      await service.emit('appointment.created', payload);

      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());
      
      expect(message.eventType).toBe('appointment.created');
      expect(message.payload).toEqual(payload);
      expect(message.correlationId).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('debería usar correlationId personalizado si se proporciona', async () => {
      const payload = { appointmentId: '123' };
      const customCorrelationId = 'custom-id-123';
      
      await service.emit('appointment.created', payload, customCorrelationId);

      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());
      
      expect(message.correlationId).toBe(customCorrelationId);
    });

    it('debería manejar errores de publicación con reintentos', async () => {
      mockChannel.publish
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockResolvedValue(undefined);

      const payload = { appointmentId: '123' };
      
      await service.emit('appointment.created', payload);

      expect(mockChannel.publish).toHaveBeenCalledTimes(4);
    });

    it('debería usar backoff exponencial en reintentos', async () => {
      mockChannel.publish
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockResolvedValue(undefined);

      jest.useFakeTimers();
      const payload = { appointmentId: '123' };
      
      const emitPromise = service.emit('appointment.created', payload);
      
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(2000);
      jest.advanceTimersByTime(4000);

      await emitPromise;

      expect(mockChannel.publish).toHaveBeenCalledTimes(4);
      jest.useRealTimers();
    });

    it('debería publicar en DLQ después de máximos reintentos', async () => {
      mockChannel.publish
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'));

      const payload = { appointmentId: '123' };
      
      await service.emit('appointment.created', payload);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'beautyspot.dlx',
        'appointment.created',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          deliveryMode: 2,
        }),
      );
    });

    it('debería incluir información de error en DLQ', async () => {
      mockChannel.publish
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'))
        .mockRejectedValueOnce(new Error('Publish error'));

      const payload = { appointmentId: '123' };
      
      await service.emit('appointment.created', payload);

      const dlqCall = mockChannel.publish.mock.calls.find(
        (call: any[]) => call[0] === 'beautyspot.dlx'
      );
      
      const dlqMessage = JSON.parse(dlqCall[2].toString());
      expect(dlqMessage.error).toBe('Publish error');
      expect(dlqMessage.failedAt).toBeDefined();
      expect(dlqMessage.stackTrace).toBeDefined();
    });

    it('debería manejar canal no disponible', async () => {
      service['channel'] = null;
      service['connection'] = null;
      mockAmqp.default.connect.mockRejectedValue(new Error('Connection failed'));

      const payload = { appointmentId: '123' };
      
      await service.emit('appointment.created', payload);

      expect(mockChannel.publish).not.toHaveBeenCalled();
    });

    it('debería reconectar si canal es nulo', async () => {
      service['channel'] = null;
      service['connection'] = null;
      
      const payload = { appointmentId: '123' };
      
      await service.emit('appointment.created', payload);

      expect(mockAmqp.default.connect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('debería cerrar canal y conexión correctamente', async () => {
      await service.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('debería manejar errores al cerrar', async () => {
      mockChannel.close.mockRejectedValue(new Error('Close error'));
      mockConnection.close.mockRejectedValue(new Error('Connection close error'));

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('debería cerrar dead letter channel si existe', async () => {
      service['deadLetterChannel'] = mockChannel;
      
      await service.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
    });
  });

  describe('conexión', () => {
    it('debería crear exchanges y colas al conectar', async () => {
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('beautyspot.dlx', 'topic', { durable: true });
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('beautyspot.events', 'topic', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('beautyspot.dlx.retry', expect.any(Object));
    });

    it('debería enlazar DLQ retry queue', async () => {
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        'beautyspot.dlx.retry',
        'beautyspot.events',
        '#'
      );
    });

    it('debería manejar error de conexión', async () => {
      mockAmqp.default.connect.mockRejectedValue(new Error('Connection failed'));

      const errorService = new EventBusService(mockConfigService);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(service).toBeDefined();
    });

    it('debería manejar RABBITMQ_URL no configurado', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockAmqp.default.connect.mockClear();

      const noConfigService = new EventBusService(mockConfigService);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAmqp.default.connect).not.toHaveBeenCalled();
    });
  });

  describe('configuración de constantes', () => {
    it('debería tener constantes correctas', () => {
      expect(service['DLX_EXCHANGE']).toBe('beautyspot.dlx');
      expect(service['RETRY_EXCHANGE']).toBe('beautyspot.events');
      expect(service['MAX_RETRIES']).toBe(3);
      expect(service['RETRY_DELAY_MS']).toBe(1000);
    });
  });

  describe('configuración personalizada', () => {
    it('debería aceptar RABBITMQ_URL personalizado', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'RABBITMQ_URL') return 'amqp://custom:5672';
        return undefined;
      });

      const customService = new EventBusService(mockConfigService);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAmqp.default.connect).toHaveBeenCalledWith('amqp://custom:5672');
    });
  });
});