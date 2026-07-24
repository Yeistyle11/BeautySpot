/** Roles del sistema, de mayor a menor privilegio (ver jerarquía en CLAUDE.md). */
export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  PROFESSIONAL = "PROFESSIONAL",
  RECEPTIONIST = "RECEPTIONIST",
  CLIENT = "CLIENT",
}

/** Contenido del JWT emitido por auth-service y validado en el API Gateway. */
export interface IJwtPayload {
  sub: string;
  email: string;
  role: Role;
  businessId?: string;
  /** Lista de businessIds donde el usuario tiene membresía activa */
  businessIds?: string[];
  /** Versión del token para invalidación (ver TokenVersionStore en nest-common) */
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}
