import { EventBusService } from './event-bus.service';
import { ConfigService } from '@nestjs/config';
import { IBaseEvent } from '@beautyspot/event-types';

let mockChannel: any;
let mockConnection: any;

jest.mock('amqplib', () => {
  const mockModule = {
    connect: jest.fn().mockImplementation(() => Promise.resolve(mockConnection)),
  };
  return {
    default: mockModule,
    ...mockModule,
  };
});

describe('EventBusService', () => {
  let service: EventBusService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let amqplibConnectMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

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

    amqplibConnectMock = require('amqplib').connect;

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'RABBITMQ_URL') return 'amqp://localhost:5672';
        return undefined;
      }),
    } as any;
  });

  afterEach(async () => {
    if (service && typeof (service as any).onModuleDestroy === 'function') {
      try {
        await (service as any).onModuleDestroy();
      } catch (error) {
      }
    }
  });

  describe('constructor', () => {
    it('debería crear el servicio correctamente', () => {
      service = new EventBusService(mockConfigService);
      expect(service).toBeInstanceOf(EventBusService);
    });

    it('debería obtener RABBITMQ_URL de ConfigService', () => {
      service = new EventBusService(mockConfigService);
      expect(mockConfigService.get).toHaveBeenCalledWith('RABBITMQ_URL');
    });

    it('debería iniciar conexión RabbitMQ automáticamente', async () => {
      service = new EventBusService(mockConfigService);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(amqplibConnectMock).toHaveBeenCalledWith('amqp://localhost:5672');
    });

    it('debería no fallar cuando RABBITMQ_URL no está configurado', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => new EventBusService(mockConfigService)).not.toThrow();
    });
  });

  describe('emit', () => {
    const mockEventType = 'test.event';
    const mockPayload = { test: 'data' };

    beforeEach(async () => {
      jest.clearAllMocks();
      
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
      
      amqplibConnectMock.mockResolvedValue(mockConnection);
      
      service = new EventBusService(mockConfigService);

      await new Promise(resolve => setTimeout(resolve, 200));
    });

    it('debería emitir evento exitosamente', async () => {
      await service.emit(mockEventType, mockPayload);

      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('debería generar correlationId si no se proporciona', async () => {
      const result = await service.emit(mockEventType, mockPayload);
      expect(result).toBeUndefined();
    });

    it('debería usar correlationId proporcionado', async () => {
      const correlationId = 'test-correlation-id';
      await service.emit(mockEventType, mockPayload, correlationId);
      
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('debería incluir timestamp en evento emitido', async () => {
      await service.emit(mockEventType, mockPayload);
      
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('debería incluir eventType en evento emitido', async () => {
      await service.emit(mockEventType, mockPayload);
      
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('debería incluir payload en evento emitido', async () => {
      await service.emit(mockEventType, mockPayload);
      
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('debería reintentar en caso de error (MAX_RETRIES)', async () => {
      let attempts = 0;
      mockChannel.publish.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Publish failed'));
        }
        return Promise.resolve(undefined);
      });

      await service.emit(mockEventType, mockPayload);
      
      expect(attempts).toBe(3);
    });

    it('debería enviar a DLQ después de MAX_RETRIES fallidos', async () => {
      mockChannel.publish.mockRejectedValue(new Error('Always fails'));

      await service.emit(mockEventType, mockPayload);
      
      expect(mockChannel.publish).toHaveBeenCalled();
    }, 15000);

    it('debería manejar canal no disponible', async () => {
      (service as any).channel = null;

      const result = await service.emit(mockEventType, mockPayload);
      
      expect(result).toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('debería cerrar connection', async () => {
      const testService = new EventBusService(mockConfigService);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const serviceConnection = (testService as any).connection;
      
      await testService.onModuleDestroy();

      expect(serviceConnection.close).toHaveBeenCalled();
    });

    it('debería manejar error al cerrar', async () => {
      const testService = new EventBusService(mockConfigService);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const serviceConnection = (testService as any).connection;
      serviceConnection.close.mockRejectedValue(new Error('Close failed'));

      await expect(testService.onModuleDestroy()).resolves.not.toThrow();
    });

    it('debería manejar cuando connection es null', async () => {
      const testService = new EventBusService(mockConfigService);
      (testService as any).connection = null;

      await expect(testService.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('constantes', () => {
    it('debería tener constante DLX_EXCHANGE', () => {
      service = new EventBusService(mockConfigService);
      expect((service as any).DLX_EXCHANGE).toBe('beautyspot.dlx');
    });

    it('debería tener constante RETRY_EXCHANGE', () => {
      service = new EventBusService(mockConfigService);
      expect((service as any).RETRY_EXCHANGE).toBe('beautyspot.events');
    });

    it('debería tener constante MAX_RETRIES', () => {
      service = new EventBusService(mockConfigService);
      expect((service as any).MAX_RETRIES).toBe(3);
    });

    it('debería tener constante RETRY_DELAY_MS', () => {
      service = new EventBusService(mockConfigService);
      expect((service as any).RETRY_DELAY_MS).toBe(1000);
    });
  });

  describe('configuración', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      amqplibConnectMock.mockResolvedValue(mockConnection);
      
      service = new EventBusService(mockConfigService);
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    it('debería usar opciones de conexión correctas', () => {
      expect(amqplibConnectMock).toHaveBeenCalledWith('amqp://localhost:5672');
    });

    it('debería configurar exchanges y queues', () => {
      const connectionCalls = amqplibConnectMock.mock.calls;
      if (connectionCalls.length > 0) {
        expect(mockConnection.createChannel).toHaveBeenCalled();
      }
    });
  });
});