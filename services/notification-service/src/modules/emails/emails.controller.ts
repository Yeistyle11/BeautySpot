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

  @Post("appointment/confirmation")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentConfirmation(
    @Body() dto: SendAppointmentConfirmationDto
  ) {
    await this.emailService.queueAppointmentConfirmation(dto.to, dto);
    return { message: "Email de confirmación encolado" };
  }

  @Post("appointment/reminder-24h")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder24h(@Body() dto: SendAppointmentReminder24hDto) {
    await this.emailService.queueAppointmentReminder24h(dto.to, dto);
    return { message: "Email de recordatorio 24h encolado" };
  }

  @Post("appointment/reminder-1h")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder1h(@Body() dto: SendAppointmentReminder1hDto) {
    await this.emailService.queueAppointmentReminder1h(dto.to, dto);
    return { message: "Email de recordatorio 1h encolado" };
  }

  @Post("appointment/cancelled")
  @HttpCode(HttpStatus.OK)
  async sendAppointmentCancelled(@Body() dto: SendAppointmentCancelledDto) {
    await this.emailService.queueAppointmentCancelled(dto.to, dto);
    return { message: "Email de cancelación encolado" };
  }

  @Post("invoice")
  @HttpCode(HttpStatus.OK)
  async sendInvoice(@Body() dto: SendInvoiceDto) {
    await this.emailService.queueInvoice(dto.to, dto);
    return { message: "Email de factura encolado" };
  }

  @Post("password-reset")
  @HttpCode(HttpStatus.OK)
  async sendPasswordReset(@Body() dto: SendPasswordResetDto) {
    await this.emailService.queuePasswordReset(dto.to, dto);
    return { message: "Email de reset encolado" };
  }

  @Post("welcome")
  @HttpCode(HttpStatus.OK)
  async sendWelcomeEmail(@Body() dto: SendWelcomeEmailDto) {
    await this.emailService.queueWelcomeEmail(dto.to, dto);
    return { message: "Email de bienvenida encolado" };
  }

  @Post("monthly-report")
  @HttpCode(HttpStatus.OK)
  async sendMonthlyReport(@Body() dto: SendMonthlyReportDto) {
    await this.emailService.queueMonthlyReport(dto.to, dto);
    return { message: "Email de reporte mensual encolado" };
  }
}
