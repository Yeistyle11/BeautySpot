import { IAuditFields } from "./common.types";
import { Role } from "./auth.types";

export interface IUser extends IAuditFields {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  active: boolean;
  currentBusinessId?: string;
}

export interface ICreateUser {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: Role;
}

export interface IUpdateUser {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface IUserProfile extends IUser {
  memberships: {
    businessId: string;
    businessName: string;
    role: Role;
    active: boolean;
  }[];
}
