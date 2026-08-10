import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** Cabecera con la sede sobre la que trabaja quien hace la petición. */
export const BRANCH_ID_HEADER = "x-branch-id";

/** Inyecta la sede activa; `undefined` significa el negocio entero. */
export const BranchId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const valor = ctx.switchToHttp().getRequest().headers?.[BRANCH_ID_HEADER];
    return typeof valor === "string" && valor.length > 0 ? valor : undefined;
  }
);
