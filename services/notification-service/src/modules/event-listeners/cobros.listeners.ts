import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { NotificationType, PaymentMethod } from "@beautyspot/shared-types";
import {
  InvoiceGeneratedEvent,
  PaymentRegisteredEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { AvisosService } from "./avisos.service";

/**
 * Métodos de pago que no dejan comprobante al cliente y por eso llevan recibo
 * por correo. Con datáfono lo da el propio terminal.
 */
const METODOS_CON_RECIBO: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
];

/**
 * Lo que el cliente recibe cuando se le cobra: la factura y el recibo del
 * pago. No hay avisos al equipo.
 */
@Injectable()
export class CobrosListeners {
  private readonly logger = new Logger(CobrosListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly processedEvents: ProcessedEventsStore,
    private readonly dataEnricher: DataEnricherService,
    private readonly avisos: AvisosService
  ) {}

  /** Al generarse una factura, encola su envío por correo al cliente. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_INVOICE_GENERATED,
    queue: nombreDeCola("notification", EventNames.PAYMENT_INVOICE_GENERATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleInvoiceGenerated(event: InvoiceGeneratedEvent) {
    const { invoiceId, number, total, clientId, businessId, dueDate, items } =
      event.payload;

    this.logger.log(`Factura generada: ${invoiceId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:factura",
        async () => {
          const [clientEmail, clientName, businessData] = await Promise.all([
            this.dataEnricher.enrichClientEmail(clientId),
            this.dataEnricher.enrichClientName(clientId),
            this.dataEnricher.enrichBusinessData(businessId),
          ]);

          const { jobId } = await this.emailService.queueInvoice(clientEmail, {
            clientName,
            invoiceNumber: number.toString(),
            amount: total,
            // El vencimiento lo fija payment al emitir; si el evento no lo
            // trae, es más honesto no adelantar una fecha inventada.
            dueDate: dueDate ?? "",
            businessName: businessData.businessName,
            services: (items ?? []).map((i) => ({
              name: i.description,
              price: i.total,
            })),
          });

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            clientEmail,
            "invoice-generated",
            `Factura #${number} - ${businessData.businessName}`
          );
        }
      );
    } catch (error) {
      this.avisos.logError("factura", error);
    }
  }

  /** Ante un pago en efectivo o transferencia, encola el recibo por correo. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_PAYMENT_REGISTERED,
    queue: nombreDeCola("notification", EventNames.PAYMENT_PAYMENT_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePaymentRegistered(event: PaymentRegisteredEvent) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);

    try {
      await this.processedEvents.once(event, "notification:pago", async () => {
        const { clientId, businessId, paymentId, amount, services } =
          event.payload;
        const [clientEmail, businessData, clientUserId] = await Promise.all([
          this.dataEnricher.enrichClientEmail(clientId),
          this.dataEnricher.enrichBusinessData(businessId),
          this.dataEnricher.enrichClientUserId(clientId),
        ]);

        await this.avisos.avisarEnLaApp(
          clientUserId,
          businessId,
          NotificationType.PAYMENT_REGISTERED,
          "Pago registrado",
          `${businessData.businessName} registró tu pago de ${amount}.`,
          { paymentId, amount }
        );

        // El recibo por correo solo tiene sentido en los métodos sin
        // comprobante propio; con datáfono lo da el propio terminal.
        if (METODOS_CON_RECIBO.includes(event.payload.method)) {
          const clientName = await this.dataEnricher.enrichClientName(clientId);
          await this.avisos.intentarCorreo(
            "recibo",
            async () => {
              const { jobId } = await this.emailService.queueInvoice(
                clientEmail,
                {
                  clientName,
                  invoiceNumber: `REC-${paymentId}`,
                  amount,
                  dueDate: new Date().toISOString().split("T")[0],
                  businessName: businessData.businessName,
                  // Un cobro suelto no tiene cita detrás, y entonces lo
                  // único cierto que se puede imprimir es el importe.
                  services: services?.length
                    ? services.map((s) => ({ name: s.name, price: s.price }))
                    : [{ name: "Servicio", price: amount }],
                }
              );

              await this.avisos.emitEmailQueuedEvent(
                jobId,
                clientEmail,
                "invoice-generated",
                `Recibo de pago - ${businessData.businessName}`
              );
            },
            {
              userId: clientUserId,
              businessId,
              type: NotificationType.PAYMENT_REGISTERED,
            }
          );
        }
      });
    } catch (error) {
      this.avisos.logError("pago", error);
    }
  }
}
