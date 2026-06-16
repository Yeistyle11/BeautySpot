import { IAuditFields } from "./common.types";

export interface IProfessional extends IAuditFields {
  id: string;
  businessId: string;
  branchId?: string;
  userId?: string;
  bio?: string;
  specialties: string[];
  yearsExp: number;
  rating: number;
  totalReviews: number;
  portfolio: { image: string; title?: string; description?: string }[];
  active: boolean;
}

export interface ICreateProfessional {
  branchId?: string;
  userId?: string;
  name: string;
  bio?: string;
  specialties: string[];
  yearsExp: number;
  email?: string;
  phone?: string;
}

export interface IUpdateProfessional {
  bio?: string;
  specialties?: string[];
  yearsExp?: number;
  branchId?: string;
  portfolio?: { image: string; title?: string; description?: string }[];
}

export interface IProfessionalService {
  id: string;
  professionalId: string;
  serviceId: string;
  customPrice?: number;
  customDuration?: number;
}

export interface IAssignService {
  serviceId: string;
  customPrice?: number;
  customDuration?: number;
}
