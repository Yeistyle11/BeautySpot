import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  ClientMergedEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { PaymentEntity } from "../payments/payment.entity";
import { InvoiceEntity } from "../invoices/invoice.entity";

/** Escucha los eventos de otros servicios que mueven cobros y facturas. */
@Injectable()
export class PaymentEventListeners {
  private readonly logger = new Logger(PaymentEventListeners.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>
  ) {}

  /**
   * Dos fichas del mismo cliente pasaron a ser una: sus cobros y sus facturas
   * pasan a la ficha buena, para que el dinero que esa persona dejó no cuelgue
   * de una ficha que ya no se lista.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_CLIENT_MERGED,
    queue: nombreDeCola("payment", EventNames.CORE_CLIENT_MERGED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleClientMerged(event: ClientMergedEvent): Promise<void> {
    const { businessId, supervivienteId, absorbidoId } = event.payload;

    // Reasignar es idempotente: una reentrega no encuentra ya nada que mover.
    const [cobros, facturas] = await Promise.all([
      this.paymentRepo.update(
        { businessId, clientId: absorbidoId },
        { clientId: supervivienteId }
      ),
      this.invoiceRepo.update(
        { businessId, clientId: absorbidoId },
        { clientId: supervivienteId }
      ),
    ]);

    this.logger.log(
      `Fusión de clientes ${absorbidoId} → ${supervivienteId}: ` +
        `${cobros.affected ?? 0} cobros y ${facturas.affected ?? 0} facturas reasignados`
    );
  }
}
