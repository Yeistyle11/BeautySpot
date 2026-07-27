import { HttpException, HttpStatus } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  const mockResponse = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };

  const createMockArgumentsHost = (response: any, type = "http") => {
    return {
      getType: jest.fn().mockReturnValue(type),
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(response),
      }),
    } as any;
  };

  describe("constructor", () => {
    it("debería crear instancia correctamente", () => {
      expect(filter).toBeInstanceOf(HttpExceptionFilter);
    });
  });

  describe("catch - HttpException básico", () => {
    it("debería manejar HttpException con mensaje simple", () => {
      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Test error",
          },
          statusCode: HttpStatus.BAD_REQUEST,
        })
      );
    });

    it("debería manejar UNAUTHORIZED con código correcto", () => {
      const exception = new HttpException(
        "Unauthorized",
        HttpStatus.UNAUTHORIZED
      );
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "AUTH_UNAUTHORIZED",
          }),
        })
      );
    });

    it("debería manejar FORBIDDEN con código correcto", () => {
      const exception = new HttpException("Forbidden", HttpStatus.FORBIDDEN);
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "AUTH_FORBIDDEN",
          }),
        })
      );
    });

    it("debería manejar NOT_FOUND con código correcto", () => {
      const exception = new HttpException("Not found", HttpStatus.NOT_FOUND);
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "NOT_FOUND",
          }),
        })
      );
    });

    it("debería conservar el código y el mensaje del sobre ya formado", () => {
      const exception = new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Demasiadas solicitudes",
          },
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "RATE_LIMIT_EXCEEDED",
            message: "Demasiadas solicitudes",
          }),
        })
      );
    });

    it("relanza cuando no es una petición HTTP", () => {
      const exception = new Error("fallo al procesar el evento");
      const response = mockResponse();
      const host = createMockArgumentsHost(response, "rmq");

      expect(() => filter.catch(exception, host)).toThrow(exception);
      expect(response.json).not.toHaveBeenCalled();
    });

    it("debería manejar CONFLICT con código correcto", () => {
      const exception = new HttpException(
        "La categoría ya existe",
        HttpStatus.CONFLICT
      );
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "CONFLICT",
            message: "La categoría ya existe",
          }),
        })
      );
    });

    it("debería manejar BAD_REQUEST con código correcto", () => {
      const exception = new HttpException(
        "Bad request",
        HttpStatus.BAD_REQUEST
      );
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
          }),
        })
      );
    });
  });

  describe("catch - errores de validación", () => {
    it("debería manejar errores de validación con array de mensajes", () => {
      const exception = new HttpException(
        { message: ["Field1 is required", "Field2 must be string"] },
        HttpStatus.BAD_REQUEST
      );
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "VALIDATION_ERROR",
            message: "Error de validación",
            details: {
              validation: ["Field1 is required", "Field2 must be string"],
            },
          }),
        })
      );
    });

    it("debería manejar errores de validación con objeto response", () => {
      const exception = new HttpException(
        {
          message: ["Invalid email format"],
          error: "Bad Request",
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST
      );
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: {
              validation: ["Invalid email format"],
            },
          }),
        })
      );
    });
  });

  describe("catch - errores genéricos", () => {
    it("debería manejar errores no HttpException", () => {
      const exception = new Error("Generic error");
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INTERNAL_ERROR",
            message: "Error interno del servidor",
          }),
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        })
      );
    });

    it("debería manejar excepciones con mensaje de string", () => {
      const exception = "String exception";
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INTERNAL_ERROR",
            message: "Error interno del servidor",
          }),
        })
      );
    });
  });

  describe("catch - timestamp", () => {
    it("debería incluir timestamp en formato ISO", () => {
      const exception = new HttpException("Test", HttpStatus.BAD_REQUEST);
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      const jsonCall = response.json.mock.calls[0][0];
      expect(jsonCall.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
      expect(new Date(jsonCall.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe("catch - estructura de respuesta", () => {
    it("debería tener estructura de respuesta consistente", () => {
      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(Object),
          statusCode: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it("success debería ser siempre false", () => {
      const exception = new HttpException("Test", HttpStatus.OK);
      const response = mockResponse();
      const host = createMockArgumentsHost(response);

      filter.catch(exception, host);

      const jsonCall = response.json.mock.calls[0][0];
      expect(jsonCall.success).toBe(false);
    });
  });
});
