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
/** Rol que el usuario tiene en un negocio concreto. */
export interface Membresia {
  businessId: string;
  role: Role;
}

export interface IJwtPayload {
  sub: string;
  email: string;
  /** Rol en el negocio por defecto; el de cada negocio va en `memberships`. */
  role: Role;
  businessId?: string;
  /** Lista de businessIds donde el usuario tiene membresía activa */
  businessIds?: string[];
  /**
   * Rol por negocio. Un mismo usuario puede ser dueño en uno y profesional en
   * otro, así que un único `role` no basta para decidir qué puede hacer.
   */
  memberships?: Membresia[];
  /** Versión del token para invalidación (ver TokenVersionStore en nest-common) */
  tokenVersion?: number;
  /** Identificador del refresh token, para poder retirarlo al canjearlo. */
  jti?: string;
  /**
   * Para qué sirve el token. `/auth/refresh` solo acepta los de refresco, de
   * modo que un access token no vale como refresh aunque ambos se firmaran con
   * el mismo secreto. Los tokens emitidos sin este claim se siguen aceptando
   * mientras caducan.
   */
  typ?: "access" | "refresh";
  iat?: number;
  exp?: number;
}
