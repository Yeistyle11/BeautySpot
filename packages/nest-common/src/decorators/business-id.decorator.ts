import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Inyecta el `businessId` del tenant resuelto por BusinessScopeGuard, que
 * garantiza que esté presente y validado antes de llegar al controlador.
 */
export const BusinessId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.businessId;
  }
);
