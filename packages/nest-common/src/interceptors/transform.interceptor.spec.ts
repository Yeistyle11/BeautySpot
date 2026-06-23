import { Test, TestingModule } from '@nestjs/testing';
import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let mockContext: ExecutionContext;
  let mockNext: CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    mockNext = {
      handle: jest.fn(),
    } as any;
  });

  describe('constructor', () => {
    it('debería crear instancia correctamente', () => {
      expect(interceptor).toBeInstanceOf(TransformInterceptor);
    });
  });

  describe('intercept', () => {
    it('debería transformar respuesta exitosa con estructura estándar', (done) => {
      const mockData = { id: '123', name: 'Test' };
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result).toEqual({
          success: true,
          data: mockData,
          timestamp: expect.any(String),
        });
        expect(new Date(result.timestamp)).toBeInstanceOf(Date);
        done();
      });
    });

    it('debería mantener el tipo de dato original', (done) => {
      const mockData = ['item1', 'item2', 'item3'];
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.data).toEqual(mockData);
        expect(Array.isArray(result.data)).toBe(true);
        done();
      });
    });

    it('debería transformar string', (done) => {
      const mockData = 'test string';
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.data).toBe(mockData);
        done();
      });
    });

    it('debería transformar number', (done) => {
      const mockData = 42;
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.data).toBe(mockData);
        done();
      });
    });

    it('debería transformar null', (done) => {
      const mockData = null;
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.data).toBeNull();
        done();
      });
    });

    it('debería transformar objetos anidados', (done) => {
      const mockData = {
        user: { id: '1', name: 'John' },
        items: [{ id: '1' }, { id: '2' }],
      };
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.data).toEqual(mockData);
        done();
      });
    });

    it('debería generar timestamp en formato ISO', (done) => {
      const mockData = { test: true };
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
        done();
      });
    });

    it('success debería ser siempre true', (done) => {
      const mockData = {};
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe((result) => {
        expect(result.success).toBe(true);
        done();
      });
    });

    it('debería llamar a next.handle() una vez', (done) => {
      const mockData = {};
      (mockNext.handle as jest.Mock).mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockNext).subscribe(() => {
        expect(mockNext.handle).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });
});