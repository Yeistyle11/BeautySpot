import { IAuditFields } from "./common.types";

export interface IClient extends IAuditFields {
  id: string;
  businessId: string;
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  loyaltyPoints: number;
  tags: string[];
  active: boolean;
}

export interface ICreateClient {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  userId?: string;
  tags?: string[];
}

export interface IUpdateClient {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
  active?: boolean;
}
