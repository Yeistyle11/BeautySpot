import { IAuditFields } from "./common.types";

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
  OTHER = "OTHER",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

export interface IPayment extends IAuditFields {
  id: string;
  businessId: string;
  appointmentId?: string;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  notes?: string;
  registeredBy: string;
}

export interface ICreatePayment {
  appointmentId?: string;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export enum CashMovementType {
  IN = "IN",
  OUT = "OUT",
}

export interface IInvoice extends IAuditFields {
  id: string;
  businessId: string;
  clientId: string;
  number: number;
  date: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  notes?: string;
  items: IInvoiceItem[];
}

export interface IInvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ICreateInvoice {
  clientId: string;
  date?: string;
  dueDate?: string;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface ICashSession {
  id: string;
  businessId: string;
  branchId?: string;
  openedBy: string;
  closedBy?: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: Date;
  closedAt?: Date;
  status: "OPEN" | "CLOSED";
  notes?: string;
}

export interface ICashMovement {
  id: string;
  cashSessionId: string;
  type: CashMovementType;
  amount: number;
  concept: string;
  registeredBy: string;
  registeredAt: Date;
}
