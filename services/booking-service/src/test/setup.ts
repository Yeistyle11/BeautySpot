import 'reflect-metadata';

// Mock de uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
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
jest.mock('@beautyspot/nest-common', () => ({
  EventBusService: jest.fn().mockImplementation(() => ({
    emit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(undefined),
  })),
}));

// Mock de http module para public-booking service
let mockHttpResponse: string = '{"data": {"id": "client-123"}}';
const mockHttpRequest = jest.fn((_options, callback) => {
  const mockResponse = {
    on: jest.fn((event, handler) => {
      if (event === 'data') handler(Buffer.from(mockHttpResponse));
      if (event === 'end') handler();
    }),
    statusCode: 200,
  } as any;
  callback(mockResponse as any);
  return { on: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
});

jest.mock('http', () => ({
  request: mockHttpRequest,
}));

export const setMockHttpResponse = (response: string) => {
  mockHttpResponse = response;
};

export const getMockHttpRequest = () => mockHttpRequest;

// Configuración global de timeouts
jest.setTimeout(10000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
  mockHttpResponse = '{"data": {"id": "client-123"}}';
});