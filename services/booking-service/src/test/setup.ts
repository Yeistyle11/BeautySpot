import "reflect-metadata";

// Mock de uuid
jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

// Mock de IoRedis
jest.mock("ioredis", () => {
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
jest.mock("amqplib", () => ({
  connect: jest.fn(),
}));

// Mock de EventBusService
jest.mock("@beautyspot/nest-common", () => ({
  EventBusService: jest.fn().mockImplementation(() => ({
    emit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(undefined),
  })),
  // Passthrough: ejecuta la operación una vez, sin la lógica real de reintento.
  withSerializableRetry: (op: () => Promise<unknown>) => op(),
}));

// Mock de global.fetch para public-booking service
let mockFetchResponse: {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
} = {
  ok: true,
  status: 200,
  json: async () => ({ success: true, data: { id: "client-123" } }),
};

const mockFetch = jest.fn(() => Promise.resolve(mockFetchResponse));

global.fetch = mockFetch as any;

export const setMockFetchResponse = (response: {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}) => {
  mockFetchResponse = {
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json:
      response.json ??
      (async () => ({ success: true, data: { id: "client-123" } })),
  };
};

export const getMockFetch = () => mockFetch;

// Configuración global de timeouts
jest.setTimeout(10000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
  mockFetchResponse = {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { id: "client-123" } }),
  };
});
