import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';
import { Logger } from '@nestjs/common';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new CircuitBreakerService();
    // Espiar Logger
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    service.reset('test-service');
    service.reset('service-1');
    service.reset('service-2');
  });

  describe('execute', () => {
    it('debería ejecutar función exitosamente en estado CLOSED', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      Date.now = jest.fn(() => 1000) as any;

      const result = await service.execute('test-service', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker OPEN')
      );
    });

    it('debería lanzar error cuando circuit breaker está OPEN', async () => {
      Date.now = jest.fn(() => 1000) as any;

      // Forzar estado OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', () => Promise.reject(new Error('fail')));
        } catch (error) {
          // Expected
        }
      }

      // Verificar que el estado sea OPEN
      const stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.state).toBe(CircuitState.OPEN);

      // Intentar ejecutar función - debería lanzar error de circuit breaker
      await expect(service.execute('test-service', () => Promise.resolve('success')))
        .rejects.toThrow('Circuit breaker OPEN for test-service');
    });

    it('debería transicionar a HALF_OPEN después de timeout', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      Date.now = jest.fn(() => 1000) as any;

      // Forzar estado OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', () => Promise.reject(new Error('fail')));
        } catch (error) {
          // Expected
        }
      }

      Date.now = jest.fn(() => 61001) as any; // 61 segundos después (TIMEOUT = 60000)

      await service.execute('test-service', fn);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker HALF_OPEN para test-service')
      );
      expect(fn).toHaveBeenCalled();
    });

    it('debería permitir llamadas exitosas en HALF_OPEN', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      Date.now = jest.fn(() => 1000) as any;

      // Forzar estado HALF_OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', () => Promise.reject(new Error('fail')));
        } catch (error) {
          // Expected
        }
      }

      Date.now = jest.fn(() => 61001) as any;
      
      // 3 llamadas exitosas para cerrar el circuit breaker
      await service.execute('test-service', fn);
      await service.execute('test-service', fn);
      await service.execute('test-service', fn);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker CLOSED para test-service')
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('debería mantener OPEN si hay más fallos en HALF_OPEN', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      Date.now = jest.fn(() => 1000) as any;

      // Forzar estado OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(service.getStateInfo('test-service')?.state).toBe(CircuitState.OPEN);

      Date.now = jest.fn(() => 61001) as any;

      // Primer intento - debería pasar a HALF_OPEN y ejecutar la función
      try {
        await service.execute('test-service', failingFn);
      } catch (error) {
        // Expected - la función falla
      }

      // El circuit breaker debería volver a OPEN por el fallo en HALF_OPEN
      expect(service.getStateInfo('test-service')?.state).toBe(CircuitState.OPEN);

      // Segundo intento inmediato - debería lanzar error de circuit breaker
      await expect(service.execute('test-service', () => Promise.resolve('success')))
        .rejects.toThrow('Circuit breaker OPEN for test-service');
    });

    it('debería resetear contador de fallos en éxito', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      Date.now = jest.fn(() => 1000) as any;

      await service.execute('test-service', fn);

      const stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.failures).toBe(0);
    });

    it('debería incrementar contador de fallos en error', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('test-service', failingFn);
        } catch (error) {
          // Expected
        }
      }

      const stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.failures).toBe(3);
    });
  });

  describe('onSuccess', () => {
    it('debería incrementar successCount en HALF_OPEN', async () => {
      Date.now = jest.fn(() => 1000) as any;

      // Forzar estado OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', () => Promise.reject(new Error('fail')));
        } catch (error) {
          // Expected
        }
      }

      expect(service.getStateInfo('test-service')?.state).toBe(CircuitState.OPEN);
      expect(service.getStateInfo('test-service')?.lastFailureTime).toBe(1000);

      Date.now = jest.fn(() => 61001) as any; // 61 segundos después

      // Primer intento - debería pasar a HALF_OPEN y ejecutar la función
      await service.execute('test-service', () => Promise.resolve('success1'));

      expect(service.getStateInfo('test-service')?.state).toBe(CircuitState.HALF_OPEN);

      // 2da llamada exitosa - successCount debería ser 2
      await service.execute('test-service', () => Promise.resolve('success2'));

      let stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.successCount).toBe(2);

      // 3ra llamada exitosa - debería cerrar el circuit breaker
      await service.execute('test-service', () => Promise.resolve('success3'));

      stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.state).toBe(CircuitState.CLOSED);
      expect(stateInfo?.successCount).toBe(0); // Reset cuando cierra
    });

    it('debería resetear failures en CLOSED', async () => {
      Date.now = jest.fn(() => 1000) as any;

      // Una falla - failures debería ser 1
      try {
        await service.execute('test-service', () => Promise.reject(new Error('fail')));
      } catch (error) {
        // Expected
      }

      let stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.failures).toBe(1);
      expect(stateInfo?.state).toBe(CircuitState.CLOSED);

      // Un éxito - failures debería resetear a 0
      await service.execute('test-service', () => Promise.resolve('success'));

      stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.failures).toBe(0);
    });
  });

  describe('onFailure', () => {
    it('debería incrementar contador de fallos', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('test-service', failingFn);
        } catch (error) {
          // Expected
        }
      }

      const stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.failures).toBe(3);
      expect(stateInfo?.lastFailureTime).toBe(1000);
    });

    it('debería transicionar a OPEN después de threshold', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
      Date.now = jest.fn(() => 1000) as any;

      // 4 fallos - aún debería estar CLOSED
      for (let i = 0; i < 4; i++) {
        try {
          await service.execute('test-service', failingFn);
        } catch (error) {
          // Expected - error original
        }
      }

      let stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.state).toBe(CircuitState.CLOSED);
      expect(stateInfo?.failures).toBe(4);

      // 5to fallo - debería abrir el circuit breaker (pero lanza error original)
      try {
        await service.execute('test-service', failingFn);
      } catch (error) {
        // Se espera error original "fail", no error de circuit breaker
        expect((error as Error).message).toBe('fail');
      }

      stateInfo = service.getStateInfo('test-service');
      expect(stateInfo?.state).toBe(CircuitState.OPEN);
      expect(stateInfo?.failures).toBe(5);

      // Siguiente intento - debería lanzar error de circuit breaker
      await expect(service.execute('test-service', () => Promise.resolve('success')))
        .rejects.toThrow('Circuit breaker OPEN for test-service');
    });
  });

  describe('reset', () => {
    it('debería eliminar estado del circuit breaker', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      Date.now = jest.fn(() => 1000) as any;

      await service.execute('test-service', fn);
      expect(service.getStateInfo('test-service')).toBeDefined();

      service.reset('test-service');

      expect(service.getStateInfo('test-service')).toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker reset para test-service')
      );
    });
  });

  describe('getAllStates', () => {
    it('debería retornar todos los estados de circuit breaker', async () => {
      const fn1 = jest.fn().mockResolvedValue('success1');
      const fn2 = jest.fn().mockRejectedValue(new Error('fail'));

      Date.now = jest.fn(() => 1000) as any;

      await service.execute('service-1', fn1);

      // service-2 falla una vez
      try {
        await service.execute('service-2', fn2);
      } catch (error) {
        // Expected
      }

      const allStates = service.getAllStates();

      expect(allStates).toHaveProperty('service-1');
      expect(allStates).toHaveProperty('service-2');
      expect(allStates['service-1'].failures).toBe(0);
      expect(allStates['service-2'].failures).toBe(1);
    });

    it('debería retornar objeto vacío si no hay servicios', () => {
      const allStates = service.getAllStates();

      expect(allStates).toEqual({});
    });
  });

  describe('getStateInfo', () => {
    it('debería retornar información del estado de un servicio específico', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      Date.now = jest.fn(() => 1000) as any;

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', fn);
        } catch (error) {
          // Expected
        }
      }

      const stateInfo = service.getStateInfo('test-service');

      expect(stateInfo).toEqual({
        state: CircuitState.OPEN,
        failures: 5,
        lastFailureTime: 1000,
        successCount: 0,
      });
    });

    it('debería retornar undefined si servicio no tiene estado', () => {
      const stateInfo = service.getStateInfo('non-existent');

      expect(stateInfo).toBeUndefined();
    });
  });
});