import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { aTextoPlano, PlantillasService } from "./plantillas.service";
import { SmtpTransport } from "./smtp.transport";
import { diaCompleto, primerNombre } from "./ayudantes-de-plantilla";
import { horaEnCastellano } from "./fechas-en-castellano";
import { enlacesDeCita, type CitaEnlazable } from "./enlaces-de-correo";

type EmailPriority = "low" | "normal" | "high";

/** Parámetros para encolar un correo: destinatario, plantilla, datos, asunto y prioridad. */
interface QueueEmailInput {
  to: string;
  template: string;
  data: Record<string, unknown>;
  subject: string;
  priority?: EmailPriority;
  /** Nombre con el que firma: el del negocio en los correos de sus citas. */
  remitente?: string;
}

/** Lo que devuelve encolar: el trabajo y el asunto con que saldrá. */
export interface CorreoEncolado {
  jobId: string;
  subject: string;
}

/** Los datos de una cita que llevan sus correos. */
export interface DatosDeCita extends CitaEnlazable {
  clientName: string;
  professionalName: string;
  serviceName: string;
  /** Minutos que dura lo reservado. */
  duration?: number;
  appointmentDate: string;
  appointmentTime: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
}

/** Datos de una factura emitida o del recibo de un cobro. */
export interface DatosDeFactura {
  clientName: string;
  invoiceNumber: string;
  /** Día de la factura o del cobro, `YYYY-MM-DD`. */
  invoiceDate?: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  services: { name: string; price: number }[];
  /** Total cobrado. */
  amount: number;
  subtotal?: number;
  tax?: number;
  /** Recibo de un cobro, no factura emitida. */
  esRecibo?: boolean;
  /** Si el cliente tiene cuenta y puede ver sus facturas en el panel. */
  conCuenta?: boolean;
}

/**
 * Compone los correos transaccionales del producto: qué plantilla lleva cada
 * aviso, con qué asunto sale, quién lo firma y a dónde llevan sus botones.
 * Renderizar y entregar son de {@link PlantillasService} y {@link SmtpTransport}.
 */
@Injectable()
export class EmailService {
  constructor(
    private readonly plantillas: PlantillasService,
    private readonly smtp: SmtpTransport,
    @InjectQueue("emails") private readonly emailQueue: Queue,
    @Optional() private readonly config?: ConfigService
  ) {}

  /** Dirección de la aplicación, sin barra final. */
  private appUrl(): string {
    return (
      this.config?.get<string>("APP_URL") ?? "http://localhost:8080"
    ).replace(/\/$/, "");
  }

  /** Renderiza la plantilla indicada y envía el correo por SMTP de inmediato. */
  async sendEmail(
    to: string,
    templateName: string,
    context: Record<string, unknown> = {}
  ): Promise<{ messageId: string }> {
    const html = this.plantillas.render(templateName, context);
    return this.smtp.enviar({
      to,
      subject:
        (context.subject as string | undefined) ||
        `BeautySpot - ${templateName}`,
      html,
      text: aTextoPlano(html),
      remitente: context.remitente as string | undefined,
    });
  }

  /** Encola el correo en BullMQ para que el worker lo envíe de forma asíncrona. */
  private async queueEmail(input: QueueEmailInput): Promise<CorreoEncolado> {
    const context = {
      ...input.data,
      subject: input.subject,
      ...(input.remitente ? { remitente: input.remitente } : {}),
    };
    const job = await this.emailQueue.add("send", {
      to: input.to,
      template: input.template,
      subject: input.subject,
      context,
      priority: input.priority ?? "normal",
    });
    return { jobId: job.id!, subject: input.subject };
  }

  /** Los datos de una cita con los enlaces que le corresponden. */
  private conEnlaces(cita: DatosDeCita): Record<string, unknown> {
    return { ...cita, ...enlacesDeCita(this.appUrl(), cita) };
  }

  /** «domingo 25 de octubre», para el asunto. */
  private dia(fecha: string): string {
    return diaCompleto(fecha).toLowerCase();
  }

  /** Acuse de la cita recién pedida, que nace pendiente de confirmar. */
  async queueAppointmentCreated(
    to: string,
    cita: DatosDeCita
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "appointment-created",
      data: this.conEnlaces(cita),
      subject: `Recibimos tu solicitud para el ${this.dia(cita.appointmentDate)}`,
      priority: "high",
      remitente: cita.businessName,
    });
  }

  /** Confirmación de la cita (prioridad alta). */
  async queueAppointmentConfirmation(
    to: string,
    cita: DatosDeCita
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "appointment-confirmed",
      data: this.conEnlaces(cita),
      subject: `Tu cita del ${this.dia(cita.appointmentDate)} está confirmada`,
      priority: "high",
      remitente: cita.businessName,
    });
  }

  /** Recordatorio del día antes. */
  async queueAppointmentReminder24h(
    to: string,
    cita: DatosDeCita
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "appointment-reminder-24h",
      data: this.conEnlaces(cita),
      subject: `Mañana a las ${horaEnCastellano(cita.appointmentTime)} te esperamos`,
      priority: "normal",
      remitente: cita.businessName,
    });
  }

  /** Recordatorio de una hora antes (prioridad alta). */
  async queueAppointmentReminder1h(
    to: string,
    cita: DatosDeCita
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "appointment-reminder-1h",
      data: this.conEnlaces(cita),
      subject: "Tu cita es en una hora",
      priority: "high",
      remitente: cita.businessName,
    });
  }

  /** Aviso de cita cancelada, con el motivo que se le puede decir al cliente. */
  async queueAppointmentCancelled(
    to: string,
    cita: DatosDeCita & {
      /** Motivo tipificado y redactado para el cliente, nunca la nota interna. */
      reason?: string;
    }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "appointment-cancelled",
      data: this.conEnlaces(cita),
      subject: `Tu cita del ${this.dia(cita.appointmentDate)} se canceló`,
      priority: "normal",
      remitente: cita.businessName,
    });
  }

  /** Factura emitida o recibo de un cobro sin comprobante propio. */
  async queueInvoice(
    to: string,
    factura: DatosDeFactura
  ): Promise<CorreoEncolado> {
    const items = factura.services.map((s) => ({
      name: s.name,
      amount: s.price,
    }));
    return this.queueEmail({
      to,
      template: "invoice-generated",
      data: {
        ...factura,
        items,
        total: factura.amount,
        ...(factura.conCuenta
          ? { enlaceFacturas: `${this.appUrl()}/dashboard/client/invoices` }
          : {}),
      },
      subject: factura.esRecibo
        ? `Tu recibo de ${factura.businessName}`
        : `Tu factura ${factura.invoiceNumber} de ${factura.businessName}`,
      priority: "normal",
      remitente: factura.businessName,
    });
  }

  /** Enlace para restablecer la contraseña (prioridad alta). */
  async queuePasswordReset(
    to: string,
    data: { clientName: string; resetLink: string; expiryHours: number }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "password-reset",
      data,
      subject: "Restablece tu contraseña de BeautySpot",
      priority: "high",
    });
  }

  /** Confirmación del correo al crear la cuenta (prioridad alta). */
  async queueEmailVerification(
    to: string,
    data: { clientName: string; verificationLink: string; expiryHours: number }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "email-verification",
      data,
      subject: "Confirma tu correo para entrar en BeautySpot",
      priority: "high",
    });
  }

  /** Petición de reseña tras la cita (prioridad baja). */
  async queueReviewRequest(
    to: string,
    data: {
      clientName: string;
      businessName: string;
      businessAddress?: string;
      businessPhone?: string;
      professionalName: string;
      reviewLink: string;
    }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "review-request",
      data,
      subject: `¿Qué tal tu visita, ${primerNombre(data.clientName)}?`,
      priority: "low",
      remitente: data.businessName,
    });
  }

  /** Felicitación de cumpleaños de parte del negocio (prioridad baja). */
  async queueBirthdayGreeting(
    to: string,
    data: {
      clientName: string;
      businessName: string;
      businessAddress?: string;
      businessPhone?: string;
    }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "birthday-greeting",
      data: {
        ...data,
        enlaceReservar: enlacesDeCita(this.appUrl(), data).enlaceReservar,
      },
      subject: `Feliz cumpleaños, ${primerNombre(data.clientName)}`,
      priority: "low",
      remitente: data.businessName,
    });
  }

  /** Bienvenida de quien se registra para reservar (prioridad baja). */
  async queueWelcomeEmail(
    to: string,
    data: { clientName: string }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "welcome-email",
      data: { ...data, enlaceExplorar: `${this.appUrl()}/marketplace` },
      subject: "Te damos la bienvenida a BeautySpot",
      priority: "low",
    });
  }

  /** Bienvenida del dueño al dar de alta su negocio (prioridad baja). */
  async queueBienvenidaNegocio(
    to: string,
    data: { clientName: string; businessName: string }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "bienvenida-negocio",
      data: { ...data, enlacePanel: `${this.appUrl()}/dashboard` },
      subject: `${data.businessName} ya está en BeautySpot`,
      priority: "low",
    });
  }

  /** Bienvenida de quien un negocio da de alta en su equipo (prioridad baja). */
  async queueBienvenidaEquipo(
    to: string,
    data: { clientName: string; businessName: string }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "bienvenida-equipo",
      data: { ...data, enlacePanel: `${this.appUrl()}/login` },
      subject: `Ya tienes acceso al equipo de ${data.businessName}`,
      priority: "low",
    });
  }

  /**
   * Aviso de que alguien intentó darse de alta con un correo que ya tiene
   * cuenta. Va con prioridad alta: es un aviso de seguridad y quien lo recibe
   * puede estar esperándolo delante de la pantalla.
   */
  async queueRegistroDuplicado(
    to: string,
    data: { clientName: string; recoveryLink: string }
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "registro-duplicado",
      data: { ...data, loginLink: `${this.appUrl()}/login` },
      subject: "Ya tienes una cuenta en BeautySpot",
      priority: "high",
    });
  }

  /** Resumen del mes del negocio (prioridad baja). Los importes van en número. */
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
  ): Promise<CorreoEncolado> {
    return this.queueEmail({
      to,
      template: "monthly-report",
      data: { ...data, enlaceReportes: `${this.appUrl()}/dashboard/analytics` },
      subject: `Así fue ${data.month} en ${data.businessName}`,
      priority: "low",
    });
  }
}
