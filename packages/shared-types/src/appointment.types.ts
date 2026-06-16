import { IAuditFields } from "./common.types";

export enum AppointmentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export interface IAppointment extends IAuditFields {
  id: string;
  businessId: string;
  branchId?: string;
  clientId: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  cancelReason?: string;
  pointsEarned: number;
  totalAmount: number;
  createdBy?: string;
  services: IAppointmentService[];
}

export interface IAppointmentService {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
}

export interface ICreateAppointment {
  professionalId: string;
  clientId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  notes?: string;
  branchId?: string;
}

export interface IRescheduleAppointment {
  date: string;
  startTime: string;
}

export interface IAvailability {
  id: string;
  businessId: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface ICreateAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface IBlockedSlot {
  id: string;
  businessId: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface ICreateBlockedSlot {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface IAvailableSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}
