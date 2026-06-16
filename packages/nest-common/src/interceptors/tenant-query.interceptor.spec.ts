import { TenantQueryInterceptor } from './tenant-query.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, Observable } from 'rxjs';

describe('TenantQueryInterceptor', () => {
  let interceptor: TenantQueryInterceptor;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;

  beforeEach(() => {
    interceptor = new TenantQueryInterceptor();
    mockCallHandler = {
      handle: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          businessId: 'business-123',
        }),
      }),
    };
  });

  describe('intercept', () => {
    it('debería interceptar llamadas correctamente', async () => {
      const result = { data: 'test' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toEqual(result);
    });

    it('debería obtener businessId del request', () => {
      const mockRequest = {
        businessId: 'business-123',
      };

      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    });

    it('debería manejar requests sin businessId', async () => {
      const mockRequest = {};
      const result = { data: 'test' };

      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toEqual(result);
    });

    it('debería preservar el comportamiento original del handler', async () => {
      const result = { data: 'test' };
      const handleFn = jest.fn().mockReturnValue(of(result));

      mockCallHandler.handle = handleFn;

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(handleFn).toHaveBeenCalled();
      expect(response).toEqual(result);
    });

    it('debería manejar errores del handler', async () => {
      const error = new Error('Handler error');
      (mockCallHandler.handle as jest.Mock).mockReturnValue(
        new Observable((observer) => {
          observer.error(error);
        })
      );

      await expect(
        interceptor.intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        ).toPromise(),
      ).rejects.toThrow('Handler error');
    });

    it('debería manejar diferentes tipos de ExecutionContext', async () => {
      const result = { data: 'test' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          businessId: 'business-456',
        }),
      });

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toEqual(result);
    });

    it('debería ser compatible con Observables', async () => {
      const result = { data: 'test' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toBeDefined();
    });

    it('debería manejar múltiples llamadas consecutivas', async () => {
      const results = [{ data: 'test1' }, { data: 'test2' }, { data: 'test3' }];
      let callCount = 0;
      
      (mockCallHandler.handle as jest.Mock).mockImplementation(() => {
        return of(results[callCount++]);
      });

      const response1 = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();
      
      const response2 = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      const response3 = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response1).toEqual(results[0]);
      expect(response2).toEqual(results[1]);
      expect(response3).toEqual(results[2]);
    });

    it('debería mantener inmutabilidad del request', () => {
      const mockRequest = {
        businessId: 'business-123',
        otherData: 'preserve',
      };

      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      expect(mockRequest.otherData).toBe('preserve');
    });
  });

  describe('interceptor configuration', () => {
    it('debería ser instanciable', () => {
      expect(interceptor).toBeInstanceOf(TenantQueryInterceptor);
    });

    it('debería tener el método intercept', () => {
      expect(typeof interceptor.intercept).toBe('function');
    });

    it('debería implementar la interfaz NestInterceptor', () => {
      expect(interceptor).toHaveProperty('intercept');
    });
  });

  describe('edge cases', () => {
    it('debería manejar businessId null', async () => {
      const result = { data: 'test' };
      
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          businessId: null,
        }),
      });
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toEqual(result);
    });

    it('debería manejar businessId undefined', async () => {
      const result = { data: 'test' };
      
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          businessId: undefined,
        }),
      });
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toEqual(result);
    });

    it('debería manejar businessId string vacía', async () => {
      const result = { data: 'test' };
      
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          businessId: '',
        }),
      });
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const response = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      ).toPromise();

      expect(response).toEqual(result);
    });
  });

  describe('performance', () => {
    it('debería ser eficiente en múltiples llamadas', async () => {
      const result = { data: 'test' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(result));

      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await interceptor.intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        ).toPromise();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});