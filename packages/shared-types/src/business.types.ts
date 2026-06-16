import { IAuditFields, BusinessType } from "./common.types";

export interface IBusiness extends IAuditFields {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  currency: string;
  locale: string;
  businessType: BusinessType;
  active: boolean;
  verified: boolean;
  planId?: string;
}

export interface ICreateBusiness {
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  currency?: string;
  locale?: string;
  businessType?: BusinessType;
}

export interface IUpdateBusiness extends Partial<ICreateBusiness> {
  logo?: string;
  coverImage?: string;
}

export interface IBranch extends IAuditFields {
  id: string;
  businessId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  active: boolean;
}

export interface ICreateBranch {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
}

export interface IBusinessConfig {
  id: string;
  businessId: string;
  key: string;
  value: Record<string, unknown>;
}

export interface IBusinessHours {
  id: string;
  businessId: string;
  branchId?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  active: boolean;
}
