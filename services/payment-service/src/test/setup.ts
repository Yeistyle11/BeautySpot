import 'reflect-metadata';

// Mock de IoRedis
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
  };
  return {
    Redis: jest.fn(() => mockRedis),
  };
});

// Mock de amqplib (RabbitMQ)
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

// Mock de AmqpConnection
jest.mock('@golevelup/nestjs-rabbitmq', () => ({
  AmqpConnection: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(true),
  })),
}));

// Configuración global de timeouts
jest.setTimeout(10000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});