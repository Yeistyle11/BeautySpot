export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  PROFESSIONAL = "PROFESSIONAL",
  RECEPTIONIST = "RECEPTIONIST",
  CLIENT = "CLIENT",
}

export interface IJwtPayload {
  sub: string;
  email: string;
  role: Role;
  businessId?: string;
  /** Lista de businessIds donde el usuario tiene membresía activa */
  businessIds?: string[];
  iat?: number;
  exp?: number;
}
