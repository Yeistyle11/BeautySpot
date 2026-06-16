import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@beautyspot/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Guard de control de acceso basado en roles (RBAC) con semántica de ALLOWLIST.
 *
 * - SUPER_ADMIN siempre tiene acceso (administrador de plataforma).
 * - Los demás roles deben estar explícitamente listados en @Roles(...).
 *
 * Esto reemplaza la jerarquía numérica anterior: @Roles(OWNER, ADMIN) ahora
 * significa "exactamente OWNER o ADMIN", no "nivel ≥ ADMIN".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException("No tienes permisos para realizar esta acción");
    }

    const userRole = user.role as Role;

    // SUPER_ADMIN: acceso completo a la plataforma
    if (userRole === Role.SUPER_ADMIN) return true;

    // Resto de roles: deben estar explícitamente autorizados
    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException("No tienes permisos para realizar esta acción");
    }

    return true;
  }
}
