import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as nodemailer from "nodemailer";
import * as handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";

type EmailPriority = "low" | "normal" | "high";

/** Parámetros para encolar un correo: destinatario, plantilla, datos, asunto y prioridad. */
interface QueueEmailInput {
  to: string;
  template: string;
  data: Record<string, unknown>;
  subject: string;
  priority?: EmailPriority;
  pdfPath?: string;
  currencyFields?: string[];
}

/**
 * Compone y envía los correos transaccionales con plantillas Handlebars y SMTP.
 * Ofrece envío directo y encolado (BullMQ) para cada tipo de correo del sistema.
 */
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, handlebars.TemplateDelegate>;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue("emails") private readonly emailQueue: Queue
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("SMTP_HOST"),
      port: parseInt(this.configService.get<string>("SMTP_PORT", "587")),
      secure: this.configService.get<string>("SMTP_SECURE", "false") === "true",
      auth: {
        user: this.configService.get<string>("SMTP_USER"),
        pass: this.configService.get<string>("SMTP_PASS"),
      },
    });
    this.templates = new Map();
    this.loadTemplates();
  }

  /** Compila y cachea todas las plantillas .hbs de la carpeta templates al arrancar. */
  private loadTemplates() {
    const templatesDir = path.join(__dirname, "templates");
    if (!fs.existsSync(templatesDir)) return;

    for (const file of fs
      .readdirSync(templatesDir)
      .filter((f) => f.endsWith(".hbs"))) {
      const content = fs.readFileSync(path.join(templatesDir, file), "utf-8");
      this.templates.set(file.replace(".hbs", ""), handlebars.compile(content));
    }
  }

  // ─── Core send/queue ──────────────────────────────────────

  /** Renderiza la plantilla indicada y envía el correo por SMTP de inmediato. */
  async sendEmail(
    to: string,
    templateName: string,
    context: Record<string, unknown> = {}
  ): Promise<{ messageId: string }> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const html = template(context);
    const info = await this.transporter.sendMail({
      from: this.configService.get<string>("EMAIL_FROM"),
      to,
      subject:
        (context.subject as string | undefined) ||
        `BeautySpot - ${templateName}`,
      html,
      text: html.replace(/<[^>]*>/g, "").trim(),
    });
    return { messageId: info.messageId };
  }

  /** Encola el correo en BullMQ para que el worker lo envíe de forma asíncrona. */
  private async queueEmail(input: QueueEmailInput): Promise<{ jobId: string }> {
    const context = { ...input.data, subject: input.subject };
    const job = await this.emailQueue.add("send", {
      to: input.to,
      template: input.template,
      context,
      pdfPath: input.pdfPath,
      priority: input.priority ?? "normal",
    });
    return { jobId: job.id! };
  }

  // ─── Direct send methods ──────────────────────────────────

  /** Envía el correo de confirmación de una cita. */
  async sendAppointmentConfirmation(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      appointmentDate: string;
      appointmentTime: string;
      businessName: string;
      businessAddress: string;
      businessPhone: string;
    }
  ): Promise<void> {
    await this.sendEmail(to, "appointment-confirmed", {
      ...data,
      subject: `Confirmación de cita en ${data.businessName}`,
    });
  }

  /** Envía el recordatorio de cita con 24 horas de antelación. */
  async sendAppointmentReminder24h(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      appointmentDate: string;
      appointmentTime: string;
      businessName: string;
      businessAddress: string;
    }
  ): Promise<void> {
    await this.sendEmail(to, "appointment-reminder-24h", {
      ...data,
      subject: `Recordatorio - Cita mañana en ${data.businessName}`,
    });
  }

  /** Envía el recordatorio de cita con 1 hora de antelación. */
  async sendAppointmentReminder1h(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      appointmentTime: string;
      businessName: string;
    }
  ): Promise<void> {
    await this.sendEmail(to, "appointment-reminder-1h", {
      ...data,
      subject: `Recordatorio - Cita en 1 hora en ${data.businessName}`,
    });
  }

  /** Envía el aviso de cita cancelada. */
  async sendAppointmentCancelled(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      cancelledDate: string;
      reason: string;
      businessName: string;
    }
  ): Promise<void> {
    await this.sendEmail(to, "appointment-cancelled", {
      ...data,
      subject: `Cita cancelada - ${data.businessName}`,
    });
  }

  /** Envía la factura por correo, adjuntando el PDF si se proporciona una ruta válida. */
  async sendInvoice(
    to: string,
    data: {
      clientName: string;
      invoiceNumber: string;
      amount: number;
      dueDate: string;
      businessName: string;
      services: { name: string; price: number }[];
    },
    pdfPath?: string
  ): Promise<{ messageId: string }> {
    const context = {
      ...data,
      amount: this.formatCurrency(data.amount),
      subject: `Factura #${data.invoiceNumber} - ${data.businessName}`,
    };

    if (pdfPath && fs.existsSync(pdfPath)) {
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>("EMAIL_FROM"),
        to,
        subject: context.subject,
        html: this.templates.get("invoice-generated")!(context),
        text: "",
        attachments: [
          { filename: `Factura_${data.invoiceNumber}.pdf`, path: pdfPath },
        ],
      });
      return { messageId: info.messageId };
    }
    return this.sendEmail(to, "invoice-generated", context);
  }

  /** Envía el correo con el enlace para restablecer la contraseña. */
  async sendPasswordReset(
    to: string,
    data: { clientName: string; resetLink: string; expiryHours: number }
  ): Promise<void> {
    await this.sendEmail(to, "password-reset", {
      ...data,
      subject: "Restablecer contraseña - BeautySpot",
    });
  }

  /** Envía el correo de bienvenida a un nuevo usuario. */
  async sendWelcomeEmail(
    to: string,
    data: { clientName: string; businessName?: string }
  ): Promise<void> {
    await this.sendEmail(to, "welcome-email", {
      ...data,
      subject: "Bienvenido a BeautySpot",
    });
  }

  /** Envía el reporte mensual del negocio (ingresos, citas y servicio top). */
  async sendMonthlyReport(
    to: string,
    data: {
      businessName: string;
      month: string;
      year: string;
      totalRevenue: number;
      totalAppointments: number;
      topService: string;
      topServiceRevenue: number;
      clientName: string;
    }
  ): Promise<void> {
    await this.sendEmail(to, "monthly-report", {
      ...data,
      totalRevenue: this.formatCurrency(data.totalRevenue),
      topServiceRevenue: this.formatCurrency(data.topServiceRevenue),
      subject: `Reporte mensual - ${data.businessName} (${data.month} ${data.year})`,
    });
  }

  // ─── Queue methods (thin wrappers over queueEmail) ────────

  /** Encola el correo de confirmación de cita (prioridad alta). */
  async queueAppointmentConfirmation(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      appointmentDate: string;
      appointmentTime: string;
      businessName: string;
      businessAddress: string;
      businessPhone: string;
    }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "appointment-confirmed",
      data,
      subject: `Confirmación de cita en ${data.businessName}`,
      priority: "high",
    });
  }

  /** Encola el recordatorio de cita de 24 horas. */
  async queueAppointmentReminder24h(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      appointmentDate: string;
      appointmentTime: string;
      businessName: string;
      businessAddress: string;
    }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "appointment-reminder-24h",
      data,
      subject: `Recordatorio - Cita mañana en ${data.businessName}`,
      priority: "normal",
    });
  }

  /** Encola el recordatorio de cita de 1 hora (prioridad alta). */
  async queueAppointmentReminder1h(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      appointmentTime: string;
      businessName: string;
    }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "appointment-reminder-1h",
      data,
      subject: `Recordatorio - Cita en 1 hora en ${data.businessName}`,
      priority: "high",
    });
  }

  /** Encola el aviso de cita cancelada. */
  async queueAppointmentCancelled(
    to: string,
    data: {
      clientName: string;
      professionalName: string;
      serviceName: string;
      cancelledDate: string;
      reason: string;
      businessName: string;
    }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "appointment-cancelled",
      data,
      subject: `Cita cancelada - ${data.businessName}`,
      priority: "normal",
    });
  }

  /** Encola el envío de una factura (con su PDF opcional). */
  async queueInvoice(
    to: string,
    data: {
      clientName: string;
      invoiceNumber: string;
      amount: number;
      dueDate: string;
      businessName: string;
      services: { name: string; price: number }[];
    },
    pdfPath?: string
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "invoice-generated",
      data: { ...data, amount: this.formatCurrency(data.amount) },
      subject: `Factura #${data.invoiceNumber} - ${data.businessName}`,
      priority: "normal",
      pdfPath,
    });
  }

  /** Encola el correo de restablecimiento de contraseña (prioridad alta). */
  async queuePasswordReset(
    to: string,
    data: { clientName: string; resetLink: string; expiryHours: number }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "password-reset",
      data,
      subject: "Restablecer contraseña - BeautySpot",
      priority: "high",
    });
  }

  /** Encola el correo de bienvenida (prioridad baja). */
  async queueWelcomeEmail(
    to: string,
    data: { clientName: string; businessName?: string }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "welcome-email",
      data,
      subject: "Bienvenido a BeautySpot",
      priority: "low",
    });
  }

  /** Encola el reporte mensual del negocio (prioridad baja). */
  async queueMonthlyReport(
    to: string,
    data: {
      businessName: string;
      month: string;
      year: string;
      totalRevenue: number;
      totalAppointments: number;
      topService: string;
      topServiceRevenue: number;
      clientName: string;
    }
  ): Promise<{ jobId: string }> {
    return this.queueEmail({
      to,
      template: "monthly-report",
      data: {
        ...data,
        totalRevenue: this.formatCurrency(data.totalRevenue),
        topServiceRevenue: this.formatCurrency(data.topServiceRevenue),
      },
      subject: `Reporte mensual - ${data.businessName} (${data.month} ${data.year})`,
      priority: "low",
    });
  }

  /** Formatea un importe como moneda colombiana (COP) sin decimales. */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
