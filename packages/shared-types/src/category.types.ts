import { IAuditFields } from "./common.types";

// ─── Categorías de Profesionales ──────────────────────────────────────

export interface IProfessionalCategory extends IAuditFields {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  active: boolean;
}

export interface ICreateProfessionalCategory {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export interface IUpdateProfessionalCategory extends Partial<ICreateProfessionalCategory> {
  active?: boolean;
}

// ─── Categorías de Servicios ──────────────────────────────────────────

export interface IServiceCategory extends IAuditFields {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  active: boolean;
}

export interface ICreateServiceCategory {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export interface IUpdateServiceCategory extends Partial<ICreateServiceCategory> {
  active?: boolean;
}
