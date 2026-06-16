import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { Queue } from 'bullmq';

// Mocks de módulos externos
jest.mock('nodemailer');
jest.mock('handlebars');
jest.mock('fs');

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockQueue: jest.Mocked<Queue>;
  let mockNodemailer: any;
  let mockHandlebars: any;
  let mockFs: any;

  beforeEach(async () => {
    // Mock ConfigService
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'SMTP_HOST') return 'smtp.example.com';
        if (key === 'SMTP_PORT') return '587';
        if (key === 'SMTP_SECURE') return 'false';
        if (key === 'SMTP_USER') return 'user@example.com';
        if (key === 'SMTP_PASS') return 'pass';
        if (key === 'EMAIL_FROM') return 'noreply@beautyspot.co';
        return undefined;
      }),
    } as any;

    // Mock BullMQ Queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    } as any;

    // Mock nodemailer
    mockNodemailer = require('nodemailer');
    mockNodemailer.createTransport = jest.fn().mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
    });

    // Mock handlebars
    mockHandlebars = require('handlebars');
    mockHandlebars.compile = jest.fn().mockReturnValue((context: any) => `HTML: ${JSON.stringify(context)}`);

    // Mock fs
    mockFs = require('fs');
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readdirSync = jest.fn().mockReturnValue([
      'welcome-email.hbs',
      'password-reset.hbs',
      'appointment-confirmed.hbs',
      'appointment-reminder-24h.hbs',
      'appointment-reminder-1h.hbs',
      'appointment-cancelled.hbs',
      'invoice-generated.hbs',
      'monthly-report.hbs',
    ]);
    mockFs.readFileSync = jest.fn().mockReturnValue('<div>{{content}}</div>');

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'BullQueue_emails',
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('debería inicializar el transporter de nodemailer con la configuración correcta', () => {
      expect(mockNodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'pass',
        },
      });
    });

    it('debería cargar templates desde el directorio', () => {
      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.readdirSync).toHaveBeenCalled();
      expect(mockHandlebars.compile).toHaveBeenCalledTimes(8);
    });
  });

  describe('sendEmail', () => {
    it('debería enviar un email con éxito', async () => {
      const result = await service.sendEmail('client@example.com', 'welcome-email', { clientName: 'Juan' });

      expect(result).toEqual({ messageId: 'msg-123' });
      const transporter = mockNodemailer.createTransport().sendMail;
      expect(transporter).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@beautyspot.co',
          to: 'client@example.com',
          subject: 'BeautySpot - welcome-email',
        })
      );
    });

    it('debería usar el subject del contexto si está disponible', async () => {
      await service.sendEmail('client@example.com', 'password-reset', { clientName: 'Juan', subject: 'Recupera tu cuenta' });

      const transporter = mockNodemailer.createTransport().sendMail;
      expect(transporter).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Recupera tu cuenta',
        })
      );
    });

    it('debería lanzar error si el template no existe', async () => {
      // Clear templates map to force error
      (service as any).templates.clear();

      await expect(service.sendEmail('client@example.com', 'non-existent', {}))
        .rejects.toThrow('Template non-existent not found');
    });
  });

  describe('sendAppointmentConfirmation', () => {
    it('debería enviar email de confirmación de cita', async () => {
      const data = {
        clientName: 'Maria',
        professionalName: 'Carlos',
        serviceName: 'Corte de cabello',
        appointmentDate: '2026-06-16',
        appointmentTime: '10:00',
        businessName: 'EliteBarbers',
        businessAddress: 'Calle 123',
        businessPhone: '555-1234',
      };

      await service.sendAppointmentConfirmation('maria@example.com', data);

      const transporter = mockNodemailer.createTransport().sendMail;
      expect(transporter).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'maria@example.com',
          subject: 'Confirmación de cita en EliteBarbers',
        })
      );
    });
  });

  describe('sendInvoice', () => {
    it('debería enviar factura con attachment si existe el PDF', async () => {
      const data = {
        clientName: 'Juan',
        invoiceNumber: 'INV-001',
        amount: 50000,
        dueDate: '2026-07-01',
        businessName: 'EliteBarbers',
        services: [{ name: 'Corte', price: 50000 }],
      };
      
      mockFs.existsSync.mockReturnValue(true);

      await service.sendInvoice('juan@example.com', data, '/path/to/invoice.pdf');

      const transporter = mockNodemailer.createTransport().sendMail;
      expect(transporter).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Factura #INV-001 - EliteBarbers',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'Factura_INV-001.pdf',
              path: '/path/to/invoice.pdf',
            }),
          ]),
        })
      );
    });

    it('debería enviar factura sin attachment si no existe el PDF', async () => {
      const data = {
        clientName: 'Juan',
        invoiceNumber: 'INV-002',
        amount: 30000,
        dueDate: '2026-07-01',
        businessName: 'EliteBarbers',
        services: [{ name: 'Barba', price: 30000 }],
      };

      await service.sendInvoice('juan@example.com', data);

      const transporter = mockNodemailer.createTransport().sendMail;
      const callArgs = transporter.mock.calls[0][0];
      expect(callArgs.attachments).toBeUndefined();
    });
  });

  describe('queueAppointmentConfirmation', () => {
    it('debería agregar trabajo a la cola con prioridad alta', async () => {
      const data = {
        clientName: 'Pedro',
        professionalName: 'Ana',
        serviceName: 'Tinte',
        appointmentDate: '2026-06-17',
        appointmentTime: '14:00',
        businessName: 'BeautySpot',
        businessAddress: 'Av. 456',
        businessPhone: '555-5678',
      };

      const result = await service.queueAppointmentConfirmation('pedro@example.com', data);

      expect(result).toEqual({ jobId: 'job-123' });
      expect(mockQueue.add).toHaveBeenCalledWith('send', expect.objectContaining({
        to: 'pedro@example.com',
        template: 'appointment-confirmed',
        priority: 'high',
      }));
    });
  });

  describe('formatCurrency', () => {
    it('debería formatear montos en pesos colombianos', () => {
      // Access private method via bracket notation for testing
      const amount = (service as any).formatCurrency(50000);
      expect(amount).toContain('$');
      expect(amount).toContain('50.000');
    });
  });
});