import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@beautyspot/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { esContextoHttp } from "./http-context";

/**
 * Control de acceso por roles con semántica de lista blanca: @Roles(OWNER,
 * ADMIN) significa exactamente esos dos, sin jerarquía. SUPER_ADMIN pasa
 * siempre, por ser administrador de plataforma.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /** Comprueba que el rol del usuario esté entre los que admite la ruta. */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    if (!esContextoHttp(context)) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException(
        "No tienes permisos para realizar esta acción"
      );
    }

    const userRole = user.role as Role;

    // SUPER_ADMIN: acceso completo a la plataforma
    if (userRole === Role.SUPER_ADMIN) return true;

    // Resto de roles: deben estar explícitamente autorizados
    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        "No tienes permisos para realizar esta acción"
      );
    }

    return true;
  }
}
