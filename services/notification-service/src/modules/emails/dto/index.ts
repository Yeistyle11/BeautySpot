import { IsEmail, IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class InvoiceServiceDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;
}

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

export class SendWelcomeEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  clientName: string;

  @IsOptional()
  @IsString()
  businessName?: string;
}

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