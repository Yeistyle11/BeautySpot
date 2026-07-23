import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Inyecta el `businessId` del tenant resuelto por BusinessScopeGuard.
 *
 * Evita el patrón `@Req() req: any` + `req.businessId`, que perdía el tipado y
 * exponía todo el objeto Request solo para leer un campo. El guard garantiza
 * que el valor esté presente y validado antes de llegar al controlador.
 */
export const BusinessId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.businessId;
  }
);
