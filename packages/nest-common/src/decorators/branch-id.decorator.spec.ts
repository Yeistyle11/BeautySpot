import { ExecutionContext } from "@nestjs/common";
import { BRANCH_ID_HEADER } from "./branch-id.decorator";

/**
 * Replica la factory de BranchId para probar su lógica de extracción sin
 * construir un contexto HTTP real (mismo enfoque que la prueba de BusinessId).
 */
const factoryFunction = (
  _data: unknown,
  ctx: ExecutionContext
): string | undefined => {
  const valor = ctx.switchToHttp().getRequest().headers?.[BRANCH_ID_HEADER];
  return typeof valor === "string" && valor.length > 0 ? valor : undefined;
};

const contextWith = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  }) as unknown as ExecutionContext;

describe("BranchId Decorator", () => {
  it("extrae la sede de la cabecera que reenvía el gateway", () => {
    const result = factoryFunction(
      undefined,
      contextWith({ headers: { [BRANCH_ID_HEADER]: "branch-1" } })
    );
    expect(result).toBe("branch-1");
  });

  it("sin cabecera devuelve undefined, que significa el negocio entero", () => {
    expect(
      factoryFunction(undefined, contextWith({ headers: {} }))
    ).toBeUndefined();
  });

  it("una cabecera vacía vale lo mismo que no mandarla", () => {
    const result = factoryFunction(
      undefined,
      contextWith({ headers: { [BRANCH_ID_HEADER]: "" } })
    );
    expect(result).toBeUndefined();
  });

  it("no falla si la petición no trae cabeceras", () => {
    expect(factoryFunction(undefined, contextWith({}))).toBeUndefined();
  });
});
