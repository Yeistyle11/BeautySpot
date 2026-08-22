import { Internal } from "@beautyspot/nest-common";
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
@Internal()
@Controller("internal/emails")
export class EmailsController {
  constructor(private readonly emailService: EmailService) {}

  /** Envía el correo de confirmación de una cita. */
  @Post("appointment/confirmation")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentConfirmation(
    @Body() dto: SendAppointmentConfirmationDto
  ) {
    await this.emailService.queueAppointmentConfirmation(dto.to, dto);
    return { message: "Email de confirmación encolado" };
  }

  /** Envía el recordatorio de cita de 24 horas. */
  @Post("appointment/reminder-24h")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder24h(@Body() dto: SendAppointmentReminder24hDto) {
    await this.emailService.queueAppointmentReminder24h(dto.to, dto);
    return { message: "Email de recordatorio 24h encolado" };
  }

  /** Envía el recordatorio de cita de 1 hora. */
  @Post("appointment/reminder-1h")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder1h(@Body() dto: SendAppointmentReminder1hDto) {
    await this.emailService.queueAppointmentReminder1h(dto.to, dto);
    return { message: "Email de recordatorio 1h encolado" };
  }

  /** Envía el aviso de cita cancelada. */
  @Post("appointment/cancelled")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentCancelled(@Body() dto: SendAppointmentCancelledDto) {
    await this.emailService.queueAppointmentCancelled(dto.to, dto);
    return { message: "Email de cancelación encolado" };
  }

  /** Envía la factura por correo. */
  @Post("invoice")
  @HttpCode(HttpStatus.OK)
  async sendInvoice(@Body() dto: SendInvoiceDto) {
    await this.emailService.queueInvoice(dto.to, dto);
    return { message: "Email de factura encolado" };
  }

  /** Envía el correo de restablecimiento de contraseña. */
  @Post("password-reset")
  @HttpCode(HttpStatus.OK)
  async sendPasswordReset(@Body() dto: SendPasswordResetDto) {
    await this.emailService.queuePasswordReset(dto.to, dto);
    return { message: "Email de reset encolado" };
  }

  /** Envía el correo de bienvenida. */
  @Post("welcome")
  @HttpCode(HttpStatus.OK)
  async sendWelcomeEmail(@Body() dto: SendWelcomeEmailDto) {
    await this.emailService.queueWelcomeEmail(dto.to, dto);
    return { message: "Email de bienvenida encolado" };
  }

  /** Envía el reporte mensual del negocio. */
  @Post("monthly-report")
  @HttpCode(HttpStatus.OK)
  async sendMonthlyReport(@Body() dto: SendMonthlyReportDto) {
    await this.emailService.queueMonthlyReport(dto.to, dto);
    return { message: "Email de reporte mensual encolado" };
  }
}
