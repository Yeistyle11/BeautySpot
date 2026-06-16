import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../email.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
}

@Processor('emails')
export class SendEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendEmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job<EmailJobData>) {
    this.logger.debug(
      `Job ${job.id} está siendo procesado. Email para: ${job.data.to}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>, result: any) {
    this.logger.debug(
      `Job ${job.id} completado exitosamente. Resultado: ${JSON.stringify(result)}`,
    );

    if (result && result.messageId) {
      this.emitEmailSentEvent(
        result.messageId,
        job.data.to,
        job.data.template,
        job.data.subject,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} falló. Email para: ${job.data.to}. Error: ${error.message}`,
      error.stack,
    );

    this.emitEmailFailedEvent(
      job.id as string,
      job.data.to,
      job.data.template,
      error.message,
    );
  }

  async process(job: Job<EmailJobData>) {
    const { to, subject, template, context } = job.data;

    this.logger.log(
      `Procesando email para ${to} con plantilla ${template} (Job ID: ${job.id})`,
    );

    try {
      const result = await this.emailService.sendEmail(to, template, context);

      this.logger.log(
        `Email enviado exitosamente para ${to} (Job ID: ${job.id}, Message ID: ${result.messageId})`,
      );

      return {
        success: true,
        messageId: result.messageId,
        to,
        subject,
        template,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error(
        `Error enviando email para ${to} (Job ID: ${job.id}): ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  private async emitEmailSentEvent(
    messageId: string,
    to: string,
    template: string,
    subject: string,
  ) {
    try {
      await this.amqpConnection.publish('beautyspot.events', 'notification.email.sent', {
        eventType: 'notification.email.sent',
        timestamp: new Date(),
        correlationId: messageId,
        payload: {
          messageId,
          to,
          template,
          subject,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error publicando evento email.sent: ${errorMessage}`, errorStack);
    }
  }

  private async emitEmailFailedEvent(
    jobId: string,
    to: string,
    template: string,
    errorMessage: string,
  ) {
    try {
      await this.amqpConnection.publish('beautyspot.events', 'notification.email.failed', {
        eventType: 'notification.email.failed',
        timestamp: new Date(),
        correlationId: jobId,
        payload: {
          jobId,
          to,
          template,
          error: errorMessage,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error publicando evento email.failed: ${errorMessage}`, errorStack);
    }
  }
}