export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  PROFESSIONAL = "PROFESSIONAL",
  RECEPTIONIST = "RECEPTIONIST",
  CLIENT = "CLIENT",
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    currentBusinessId?: string;
  };
}

export interface IRefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface IMembership {
  id: string;
  userId: string;
  businessId: string;
  role: Role;
  active: boolean;
  invitedBy?: string;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateMembership {
  userId: string;
  businessId: string;
  role: Role;
  invitedBy?: string;
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
