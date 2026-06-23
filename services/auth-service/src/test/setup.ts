import 'reflect-metadata';

// Mock de bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock de uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

// Mock de JwtService
jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
    verify: jest.fn(),
  })),
}));

// Mock de ConfigService
jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => {
      const config: any = {
        BCRYPT_SALT_ROUNDS: '12',
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        RABBITMQ_URL: 'amqp://localhost:5672',
      };
      return config[key];
    }),
  })),
}));

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

// Mock de EventBusService
jest.mock('@beautyspot/nest-common', () => {
  const originalModule = jest.requireActual('@beautyspot/nest-common');
  return {
    ...originalModule,
    EventBusService: jest.fn().mockImplementation(() => ({
      emit: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Configuración global de timeouts
jest.setTimeout(10000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});