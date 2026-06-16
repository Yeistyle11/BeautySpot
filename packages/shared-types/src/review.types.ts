import { IAuditFields } from "./common.types";

export interface IReview extends IAuditFields {
  id: string;
  businessId: string;
  appointmentId: string;
  clientId: string;
  professionalId: string;
  rating: number;
  comment?: string;
  response?: string;
  respondedAt?: Date;
}

export interface ICreateReview {
  appointmentId: string;
  professionalId: string;
  rating: number;
  comment?: string;
}
