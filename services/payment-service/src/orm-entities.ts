import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { PaymentEntity } from "./modules/payments/payment.entity";
import { InvoiceEntity } from "./modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "./modules/invoices/invoice-item.entity";
import { InvoiceSequenceEntity } from "./modules/invoices/invoice-sequence.entity";
import { CashSessionEntity } from "./modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "./modules/cash-register/cash-movement.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  PaymentEntity,
  InvoiceEntity,
  InvoiceItemEntity,
  InvoiceSequenceEntity,
  CashSessionEntity,
  CashMovementEntity,
  OutboxMessageEntity,
];
