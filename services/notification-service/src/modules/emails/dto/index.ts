import {
  IsEmail,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/** Datos del correo de confirmación de cita. */
export class SendAppointmentConfirmationDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsString()
  professionalName: string;

  @IsString()
  serviceName: string;

  @IsString()
  appointmentDate: string;

  @IsString()
  appointmentTime: string;

  @IsString()
  businessName: string;

  @IsString()
  businessAddress: string;

  @IsString()
  businessPhone: string;
}

/** Datos del recordatorio de cita de 24 horas. */
export class SendAppointmentReminder24hDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsString()
  professionalName: string;

  @IsString()
  serviceName: string;

  @IsString()
  appointmentDate: string;

  @IsString()
  appointmentTime: string;

  @IsString()
  businessName: string;

  @IsString()
  businessAddress: string;
}

/** Datos del recordatorio de cita de 1 hora. */
export class SendAppointmentReminder1hDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsString()
  professionalName: string;

  @IsString()
  serviceName: string;

  @IsString()
  appointmentTime: string;

  @IsString()
  businessName: string;
}

/** Datos del aviso de cita cancelada. */
export class SendAppointmentCancelledDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsString()
  professionalName: string;

  @IsString()
  serviceName: string;

  @IsString()
  cancelledDate: string;

  @IsString()
  reason: string;

  @IsString()
  businessName: string;
}

/** Línea de servicio incluida en el correo de una factura. */
export class InvoiceServiceDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;
}

/** Datos del correo de factura, con la ruta opcional del PDF a adjuntar. */
export class SendInvoiceDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsString()
  invoiceNumber: string;

  @IsNumber()
  amount: number;

  @IsString()
  dueDate: string;

  @IsString()
  businessName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceServiceDto)
  services: InvoiceServiceDto[];

  @IsOptional()
  @IsString()
  pdfPath?: string;
}

/** Datos del correo de restablecimiento de contraseña. */
export class SendPasswordResetDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsString()
  resetLink: string;

  @IsNumber()
  expiryHours: number;
}

/** Datos del correo de bienvenida. */
export class SendWelcomeEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsOptional()
  @IsString()
  businessName?: string;
}

/** Datos del correo de reporte mensual del negocio. */
export class SendMonthlyReportDto {
  @IsEmail()
  to: string;

  @IsString()
  businessName: string;

  @IsString()
  month: string;

  @IsString()
  year: string;

  @IsNumber()
  totalRevenue: number;

  @IsNumber()
  totalAppointments: number;

  @IsString()
  topService: string;

  @IsNumber()
  topServiceRevenue: number;

  @IsString()
  clientName: string;
}
