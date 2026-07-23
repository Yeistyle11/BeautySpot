import { ExecutionContext } from "@nestjs/common";

/**
 * Replica la factory de BusinessId para probar su lógica de extracción sin
 * construir un contexto HTTP real (mismo enfoque que la prueba de CurrentUser).
 */
const factoryFunction = (_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.businessId;
};

const contextWith = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  }) as unknown as ExecutionContext;

describe("BusinessId Decorator", () => {
  it("extrae el businessId resuelto por BusinessScopeGuard", () => {
    const result = factoryFunction(
      undefined,
      contextWith({ businessId: "biz-123" })
    );
    expect(result).toBe("biz-123");
  });

  it("devuelve undefined si el request no tiene businessId", () => {
    const result = factoryFunction(undefined, contextWith({}));
    expect(result).toBeUndefined();
  });

  it("lee el request a través de switchToHttp", () => {
    const context = contextWith({ businessId: "biz-1" });
    factoryFunction(undefined, context);
    expect(context.switchToHttp).toHaveBeenCalled();
  });
});
