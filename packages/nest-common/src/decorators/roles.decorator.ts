import { SetMetadata } from "@nestjs/common";
import { Role } from "@beautyspot/shared-types";

/** Clave de metadata con los roles permitidos (leída por RolesGuard). */
export const ROLES_KEY = "roles";
/** Restringe un endpoint a los roles indicados; el RolesGuard aplica la verificación. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
