import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@beautyspot/shared-types";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida el header X-Business-Id y verifica que el usuario autenticado
 * tenga membresía en el negocio solicitado (previene acceso cross-tenant).
 *
 * - SUPER_ADMIN puede acceder a cualquier negocio (admin de plataforma).
 * - Los demás roles deben tener el businessId en su lista de membresías del JWT.
 */
@Injectable()
export class BusinessScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    if (request.url === "/health" || request.url.startsWith("/internal")) return true;

    const businessId = request.headers["x-business-id"];
    if (!businessId || typeof businessId !== "string") {
      throw new BadRequestException("Header X-Business-Id es requerido");
    }

    if (!UUID_REGEX.test(businessId)) {
      throw new BadRequestException("Header X-Business-Id debe ser un UUID válido");
    }

    const user = request.user;
    if (user) {
      // SUPER_ADMIN: acceso completo a cualquier negocio
      if (user.role !== Role.SUPER_ADMIN) {
        const allowed = Array.isArray(user.businessIds) && user.businessIds.length > 0
          ? user.businessIds
          : user.businessId
            ? [user.businessId]
            : [];
        if (!allowed.includes(businessId)) {
          throw new ForbiddenException("No tienes acceso a este negocio");
        }
      }
    }

    request.businessId = businessId;
    return true;
  }
}
