import { ExecutionContext } from "@nestjs/common";

describe("CurrentUser Decorator", () => {
  const factoryFunction = (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  };

  it("debería ser una función", () => {
    expect(typeof factoryFunction).toBe("function");
  });

  it("debería extraer user completo cuando no se especifica propiedad", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction(undefined, context);

    expect(result).toEqual(mockUser);
  });

  it("debería extraer propiedad específica del usuario", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      role: "ADMIN",
    };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction("role", context);

    expect(result).toBe("ADMIN");
  });

  it("debería retornar undefined cuando user no existe", () => {
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: undefined }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction(undefined, context);

    expect(result).toBeUndefined();
  });

  it("debería retornar undefined cuando propiedad no existe", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction("nonExistent", context);

    expect(result).toBeUndefined();
  });

  it("debería manejar propiedades numéricas", () => {
    const mockUser = { id: "user-123", age: 30 };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction("age", context);

    expect(result).toBe(30);
  });

  it("debería manejar propiedades booleanas", () => {
    const mockUser = { id: "user-123", active: true };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction("active", context);

    expect(result).toBe(true);
  });

  it("debería manejar propiedades nulas", () => {
    const mockUser = { id: "user-123", middleName: null };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction("middleName", context);

    expect(result).toBeNull();
  });

  it("debería mantener el tipo de la propiedad extraída", () => {
    const mockUser = { id: "123", count: 42 };
    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factoryFunction("count", context);

    expect(typeof result).toBe("number");
    expect(result).toBe(42);
  });

  it("debería llamar a switchToHttp", () => {
    const mockSwitchToHttp = jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user: {} }),
    });
    const context = {
      switchToHttp: mockSwitchToHttp,
    } as unknown as ExecutionContext;

    factoryFunction(undefined, context);

    expect(mockSwitchToHttp).toHaveBeenCalled();
  });
});
