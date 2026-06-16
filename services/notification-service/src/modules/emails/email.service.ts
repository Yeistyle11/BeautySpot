import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, handlebars.TemplateDelegate>;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('emails') private readonly emailQueue: Queue,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: parseInt(this.configService.get<string>('SMTP_PORT', '587')),
      secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
    
    this.templates = new Map();
    this.loadTemplates();
  }

  private loadTemplates() {
    const templatesDir = path.join(__dirname, 'templates');
    if (fs.existsSync(templatesDir)) {
      const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.hbs'));
      
      for (const file of files) {
        const templatePath = path.join(templatesDir, file);
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const templateName = file.replace('.hbs', '');
        
        this.templates.set(templateName, handlebars.compile(templateContent));
      }
    }
  }

  async sendEmail(to: string, templateName: string, context: any): Promise<{ messageId: string }> {
    const template = this.templates.get(templateName);
    
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const html = template(context);
    const text = html.replace(/<[^>]*>/g, '').trim();

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM'),
      to,
      subject: context.subject || `BeautySpot - ${templateName}`,
      html,
      text,
    };

    const info = await this.transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
  }

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
    const context = {
      ...data,
      subject: `Confirmación de cita en ${data.businessName}`,
    };

    await this.sendEmail(to, 'appointment-confirmed', context);
  }

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
    const context = {
      ...data,
      subject: `Recordatorio - Cita mañana en ${data.businessName}`,
    };

    await this.sendEmail(to, 'appointment-reminder-24h', context);
  }

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
    const context = {
      ...data,
      subject: `Recordatorio - Cita en 1 hora en ${data.businessName}`,
    };

    await this.sendEmail(to, 'appointment-reminder-1h', context);
  }

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
    const context = {
      ...data,
      subject: `Cita cancelada - ${data.businessName}`,
    };

    await this.sendEmail(to, 'appointment-cancelled', context);
  }

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
      const attachments = [
        {
          filename: `Factura_${data.invoiceNumber}.pdf`,
          path: pdfPath,
        },
      ];

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to,
        subject: context.subject,
        html: this.templates.get('invoice-generated')!(context),
        text: '',
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { messageId: info.messageId };
    } else {
      return await this.sendEmail(to, 'invoice-generated', context);
    }
  }

  async sendPasswordReset(
    to: string,
    data: {
      clientName: string;
      resetLink: string;
      expiryHours: number;
    }
  ): Promise<void> {
    const context = {
      ...data,
      subject: 'Restablecer contraseña - BeautySpot',
    };

    await this.sendEmail(to, 'password-reset', context);
  }

  async sendWelcomeEmail(
    to: string,
    data: {
      clientName: string;
      businessName?: string;
    }
  ): Promise<void> {
    const context = {
      ...data,
      subject: 'Bienvenido a BeautySpot',
    };

    await this.sendEmail(to, 'welcome-email', context);
  }

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
    const context = {
      ...data,
      totalRevenue: this.formatCurrency(data.totalRevenue),
      topServiceRevenue: this.formatCurrency(data.topServiceRevenue),
      subject: `Reporte mensual - ${data.businessName} (${data.month} ${data.year})`,
    };

    await this.sendEmail(to, 'monthly-report', context);
  }

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
    const job = await this.emailQueue.add('send', {
      to,
      template: 'appointment-confirmed',
      context: {
        ...data,
        subject: `Confirmación de cita en ${data.businessName}`,
      },
      priority: 'high',
    });

    return { jobId: job.id! };
  }

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
    const job = await this.emailQueue.add('send', {
      to,
      template: 'appointment-reminder-24h',
      context: {
        ...data,
        subject: `Recordatorio - Cita mañana en ${data.businessName}`,
      },
      priority: 'normal',
    });

    return { jobId: job.id! };
  }

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
    const job = await this.emailQueue.add('send', {
      to,
      template: 'appointment-reminder-1h',
      context: {
        ...data,
        subject: `Recordatorio - Cita en 1 hora en ${data.businessName}`,
      },
      priority: 'high',
    });

    return { jobId: job.id! };
  }

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
    const job = await this.emailQueue.add('send', {
      to,
      template: 'appointment-cancelled',
      context: {
        ...data,
        subject: `Cita cancelada - ${data.businessName}`,
      },
      priority: 'normal',
    });

    return { jobId: job.id! };
  }

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
    const context = {
      ...data,
      amount: this.formatCurrency(data.amount),
      subject: `Factura #${data.invoiceNumber} - ${data.businessName}`,
    };

    const job = await this.emailQueue.add('send', {
      to,
      template: 'invoice-generated',
      context,
      pdfPath,
      priority: 'normal',
    });

    return { jobId: job.id! };
  }

  async queuePasswordReset(
    to: string,
    data: {
      clientName: string;
      resetLink: string;
      expiryHours: number;
    }
  ): Promise<{ jobId: string }> {
    const job = await this.emailQueue.add('send', {
      to,
      template: 'password-reset',
      context: {
        ...data,
        subject: 'Restablecer contraseña - BeautySpot',
      },
      priority: 'high',
    });

    return { jobId: job.id! };
  }

  async queueWelcomeEmail(
    to: string,
    data: {
      clientName: string;
      businessName?: string;
    }
  ): Promise<{ jobId: string }> {
    const job = await this.emailQueue.add('send', {
      to,
      template: 'welcome-email',
      context: {
        ...data,
        subject: 'Bienvenido a BeautySpot',
      },
      priority: 'low',
    });

    return { jobId: job.id! };
  }

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
    const context = {
      ...data,
      totalRevenue: this.formatCurrency(data.totalRevenue),
      topServiceRevenue: this.formatCurrency(data.topServiceRevenue),
      subject: `Reporte mensual - ${data.businessName} (${data.month} ${data.year})`,
    };

    const job = await this.emailQueue.add('send', {
      to,
      template: 'monthly-report',
      context,
      priority: 'low',
    });

    return { jobId: job.id! };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}