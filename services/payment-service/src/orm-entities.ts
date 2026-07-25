import {
  OutboxMessageEntity,
  ProcessedEventEntity,
} from "@beautyspot/nest-common";
import { PaymentEntity } from "./modules/payments/payment.entity";
import { InvoiceEntity } from "./modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "./modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "./modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "./modules/cash-register/cash-movement.entity";

/**
 * Entidades que gestiona este servicio, en un módulo aparte para que el
 * app.module y el data-source de migraciones compartan la misma lista.
 *
 * Si divergieran, `migration:generate` compararía el esquema contra una lista
 * incompleta y propondría borrar las tablas que le faltasen.
 */
export const entities = [
  ProcessedEventEntity,
  PaymentEntity,
  InvoiceEntity,
  InvoiceItemEntity,
  CashSessionEntity,
  CashMovementEntity,
  OutboxMessageEntity,
];
