import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Inyecta el usuario autenticado (payload del JWT) que dejó el JwtAuthGuard.
 * Si se pasa un nombre de campo, inyecta solo esa propiedad (ej. `@CurrentUser("sub")`).
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  }
);
