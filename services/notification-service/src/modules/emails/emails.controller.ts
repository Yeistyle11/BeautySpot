import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { EmailService } from "./email.service";
import {
  SendAppointmentConfirmationDto,
  SendAppointmentReminder24hDto,
  SendAppointmentReminder1hDto,
  SendAppointmentCancelledDto,
  SendInvoiceDto,
  SendPasswordResetDto,
  SendWelcomeEmailDto,
  SendMonthlyReportDto,
} from "./dto";

/**
 * Endpoints de envío de emails transaccionales.
 * Ruta bajo /internal/* protegida por InternalSecretGuard (x-internal-secret).
 * Solo servicios internos autorizados pueden disparar envíos de email.
 */
@Controller("internal/emails")
export class EmailsController {
  constructor(private readonly emailService: EmailService) {}

  /** Envía el correo de confirmación de una cita. */
  @Post("appointment/confirmation")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentConfirmation(
    @Body() dto: SendAppointmentConfirmationDto
  ) {
    await this.emailService.sendAppointmentConfirmation(dto.to, dto);
    return { message: "Email de confirmación enviado" };
  }

  /** Envía el recordatorio de cita de 24 horas. */
  @Post("appointment/reminder-24h")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder24h(@Body() dto: SendAppointmentReminder24hDto) {
    await this.emailService.sendAppointmentReminder24h(dto.to, dto);
    return { message: "Email de recordatorio 24h enviado" };
  }

  /** Envía el recordatorio de cita de 1 hora. */
  @Post("appointment/reminder-1h")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder1h(@Body() dto: SendAppointmentReminder1hDto) {
    await this.emailService.sendAppointmentReminder1h(dto.to, dto);
    return { message: "Email de recordatorio 1h enviado" };
  }

  /** Envía el aviso de cita cancelada. */
  @Post("appointment/cancelled")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentCancelled(@Body() dto: SendAppointmentCancelledDto) {
    await this.emailService.sendAppointmentCancelled(dto.to, dto);
    return { message: "Email de cancelación enviado" };
  }

  /** Envía la factura por correo. */
  @Post("invoice")
  @HttpCode(HttpStatus.OK)
  async sendInvoice(@Body() dto: SendInvoiceDto) {
    await this.emailService.sendInvoice(dto.to, dto, dto.pdfPath);
    return { message: "Email de factura enviado" };
  }

  /** Envía el correo de restablecimiento de contraseña. */
  @Post("password-reset")
  @HttpCode(HttpStatus.OK)
  async sendPasswordReset(@Body() dto: SendPasswordResetDto) {
    await this.emailService.sendPasswordReset(dto.to, dto);
    return { message: "Email de reset enviado" };
  }

  /** Envía el correo de bienvenida. */
  @Post("welcome")
  @HttpCode(HttpStatus.OK)
  async sendWelcomeEmail(@Body() dto: SendWelcomeEmailDto) {
    await this.emailService.sendWelcomeEmail(dto.to, dto);
    return { message: "Email de bienvenida enviado" };
  }

  /** Envía el reporte mensual del negocio. */
  @Post("monthly-report")
  @HttpCode(HttpStatus.OK)
  async sendMonthlyReport(@Body() dto: SendMonthlyReportDto) {
    await this.emailService.sendMonthlyReport(dto.to, dto);
    return { message: "Email de reporte mensual enviado" };
  }
}
