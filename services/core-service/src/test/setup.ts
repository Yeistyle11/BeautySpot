import "reflect-metadata";

// Mock de uuid
jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

// Mock de ConfigService
jest.mock("@nestjs/config", () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "test-key",
        AWS_SECRET_ACCESS_KEY: "test-secret",
        AWS_S3_BUCKET: "test-bucket",
      };
      return config[key];
    }),
  })),
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
}));

// Mock de AWS S3
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://test-signed-url.com"),
}));

// Configuración global de timeouts
jest.setTimeout(10000);

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
