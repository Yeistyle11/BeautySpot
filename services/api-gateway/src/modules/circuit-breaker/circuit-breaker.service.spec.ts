import { CircuitBreakerService, CircuitState } from "./circuit-breaker.service";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

describe("CircuitBreakerService", () => {
  let service: CircuitBreakerService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "CIRCUIT_BREAKER_THRESHOLD") return 5;
        if (key === "CIRCUIT_BREAKER_TIMEOUT_MS") return 60000;
        if (key === "CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS") return 3;
        return undefined;
      }),
    } as any;

    service = new CircuitBreakerService(mockConfigService);
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    service.reset("test-service");
    service.reset("service-1");
    service.reset("service-2");
  });

  describe("execute", () => {
    it("debería ejecutar función exitosamente en estado CLOSED", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      Date.now = jest.fn(() => 1000) as any;

      const result = await service.execute("test-service", fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalled();
    });

    it("debería lanzar error cuando circuit breaker está OPEN", async () => {
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("test-service", () =>
            Promise.reject(new Error("fail"))
          );
        } catch {
          // Expected
        }
      }

      const stateInfo = service.getStateInfo("test-service");
      expect(stateInfo?.state).toBe(CircuitState.OPEN);

      await expect(
        service.execute("test-service", () => Promise.resolve("success"))
      ).rejects.toThrow("Circuit breaker OPEN for test-service");
    });

    it("debería transicionar a HALF_OPEN después de timeout", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("test-service", () =>
            Promise.reject(new Error("fail"))
          );
        } catch {
          // Expected
        }
      }

      Date.now = jest.fn(() => 61001) as any;

      await service.execute("test-service", fn);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Circuit breaker HALF_OPEN para test-service")
      );
      expect(fn).toHaveBeenCalled();
    });

    it("debería permitir llamadas exitosas en HALF_OPEN", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("test-service", () =>
            Promise.reject(new Error("fail"))
          );
        } catch {
          // Expected
        }
      }

      Date.now = jest.fn(() => 61001) as any;

      await service.execute("test-service", fn);
      await service.execute("test-service", fn);
      await service.execute("test-service", fn);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Circuit breaker CLOSED para test-service")
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("debería mantener OPEN si hay más fallos en HALF_OPEN", async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error("fail"));
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("test-service", failingFn);
        } catch {
          // Expected
        }
      }

      expect(service.getStateInfo("test-service")?.state).toBe(
        CircuitState.OPEN
      );

      Date.now = jest.fn(() => 61001) as any;

      try {
        await service.execute("test-service", failingFn);
      } catch {
        // Expected
      }

      expect(service.getStateInfo("test-service")?.state).toBe(
        CircuitState.OPEN
      );

      await expect(
        service.execute("test-service", () => Promise.resolve("success"))
      ).rejects.toThrow("Circuit breaker OPEN for test-service");
    });

    it("debería resetear contador de fallos en éxito", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      Date.now = jest.fn(() => 1000) as any;

      await service.execute("test-service", fn);

      expect(service.getStateInfo("test-service")?.failures).toBe(0);
    });

    it("debería loguear el error en onFailure", async () => {
      Date.now = jest.fn(() => 1000) as any;

      try {
        await service.execute("test-service", () =>
          Promise.reject(new Error("connection refused"))
        );
      } catch {
        // Expected
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("connection refused")
      );
    });
  });

  describe("reset", () => {
    it("debería eliminar estado del circuit breaker", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      Date.now = jest.fn(() => 1000) as any;

      await service.execute("test-service", fn);
      expect(service.getStateInfo("test-service")).toBeDefined();

      service.reset("test-service");

      expect(service.getStateInfo("test-service")).toBeUndefined();
    });
  });

  describe("getAllStates", () => {
    it("debería retornar todos los estados", async () => {
      Date.now = jest.fn(() => 1000) as any;

      await service.execute("service-1", () => Promise.resolve("ok"));

      try {
        await service.execute("service-2", () =>
          Promise.reject(new Error("fail"))
        );
      } catch {
        // Expected
      }

      const allStates = service.getAllStates();

      expect(allStates).toHaveProperty("service-1");
      expect(allStates).toHaveProperty("service-2");
      expect(allStates["service-1"].failures).toBe(0);
      expect(allStates["service-2"].failures).toBe(1);
    });

    it("debería retornar objeto vacío si no hay servicios", () => {
      expect(service.getAllStates()).toEqual({});
    });
  });

  describe("getStateInfo", () => {
    it("debería retornar undefined si servicio no tiene estado", () => {
      expect(service.getStateInfo("non-existent")).toBeUndefined();
    });
  });
});
