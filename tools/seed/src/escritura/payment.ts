import { DataSource } from "typeorm";
import {
  CashMovementType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  METODO_MIXTO,
  type MetodoDeCobro,
} from "@beautyspot/shared-types";
import { PaymentEntity } from "../../../../services/payment-service/src/modules/payments/payment.entity";
import { PaymentSplitEntity } from "../../../../services/payment-service/src/modules/payments/payment-split.entity";
import { CashSessionEntity } from "../../../../services/payment-service/src/modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../../../../services/payment-service/src/modules/cash-register/cash-movement.entity";
import { InvoiceEntity } from "../../../../services/payment-service/src/modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../../../../services/payment-service/src/modules/invoices/invoice-item.entity";
import { InvoiceSequenceEntity } from "../../../../services/payment-service/src/modules/invoices/invoice-sequence.entity";
import type { Siembra } from "../datos";
import { instante } from "../fechas";
import { idDe } from "../identidades";
import { borrarHuerfanas, borrarPorNegocio, guardar } from "./comun";

/**
 * Cobros, caja y facturas. Cada cobro guarda su reparto por medio aunque haya
 * entrado por uno solo: la caja y el arqueo leen siempre de las líneas, así que
 * un cobro sin ellas sería invisible para el cajón.
 */
export async function sembrarPayment(dataSource: DataSource, siembra: Siembra) {
  const cobros: PaymentEntity[] = [];
  const lineas: PaymentSplitEntity[] = [];

  for (const c of siembra.cobros) {
    cobros.push(
      Object.assign(new PaymentEntity(), {
        id: c.id,
        businessId: c.negocioId,
        branchId: c.sedeId,
        appointmentId: c.citaId,
        clientId: c.clienteId,
        solicitudId: null,
        amount: c.importe,
        method: (c.metodo === "MIXED"
          ? METODO_MIXTO
          : c.metodo) as MetodoDeCobro,
        status: PaymentStatus.COMPLETED,
        puntosUsados: 0,
        descuento: 0,
        descuentoComercial: c.descuentoComercial,
        motivoDescuento: c.motivoDescuento,
        propina: c.propina,
        propinaProfesionalId: c.propina ? c.profesionalId : null,
        registeredBy: c.registradoPor,
        createdAt: instante(c.fecha, c.hora),
      })
    );

    for (const l of c.lineas) {
      lineas.push(
        Object.assign(new PaymentSplitEntity(), {
          id: l.id,
          paymentId: c.id,
          method: l.metodo as PaymentMethod,
          amount: l.importe,
        })
      );
    }
  }

  const cajas: CashSessionEntity[] = [];
  const movimientos: CashMovementEntity[] = [];

  for (const s of siembra.cajas) {
    cajas.push(
      Object.assign(new CashSessionEntity(), {
        id: s.id,
        businessId: s.negocioId,
        branchId: s.sedeId,
        openedBy: s.abiertaPor,
        closedBy: s.cerradaPor,
        openingAmount: s.aperturaImporte,
        closingAmount: s.cierreImporte,
        expectedTotal: s.esperado,
        difference: s.diferencia,
        openedAt: s.abiertaEn,
        closedAt: s.cerradaEn,
        notes: s.notas,
      })
    );

    for (const m of s.movimientos) {
      movimientos.push(
        Object.assign(new CashMovementEntity(), {
          id: m.id,
          cashSessionId: s.id,
          type: m.tipo as CashMovementType,
          amount: m.importe,
          concept: m.concepto,
          method: m.metodo as PaymentMethod | null,
          paymentId: m.cobroId,
          registeredBy: m.registradoPor,
        })
      );
    }
  }

  const facturas: InvoiceEntity[] = [];
  const renglones: InvoiceItemEntity[] = [];

  for (const f of siembra.facturas) {
    facturas.push(
      Object.assign(new InvoiceEntity(), {
        id: f.id,
        businessId: f.negocioId,
        clientId: f.clienteId,
        paymentId: f.cobroId,
        number: f.numero,
        date: f.fecha,
        dueDate: f.vence,
        subtotal: f.base,
        taxRate: f.tasa,
        tax: f.impuesto,
        total: f.total,
        status: InvoiceStatus.PAID as InvoiceStatus,
      })
    );
    for (const r of f.lineas) {
      renglones.push(
        Object.assign(new InvoiceItemEntity(), {
          id: r.id,
          invoiceId: f.id,
          description: r.descripcion,
          quantity: r.cantidad,
          unitPrice: r.precio,
          total: r.precio * r.cantidad,
        })
      );
    }
  }

  // La serie queda donde la dejó la última factura: emitir la siguiente desde
  // el panel tiene que continuar la numeración, no repetirla.
  const anio = new Date().getFullYear();
  const series = siembra.negocios.map((n) => {
    const suyas = siembra.facturas.filter((f) => f.negocioId === n.id);
    return Object.assign(new InvoiceSequenceEntity(), {
      id: idDe(`serie:${n.id}:${anio}`),
      businessId: n.id,
      serie: "A",
      year: anio,
      lastNumber: suyas.length,
    });
  });

  return {
    cobros: await guardar(dataSource, PaymentEntity, cobros),
    lineas: await guardar(dataSource, PaymentSplitEntity, lineas),
    cajas: await guardar(dataSource, CashSessionEntity, cajas),
    movimientos: await guardar(dataSource, CashMovementEntity, movimientos),
    facturas: await guardar(dataSource, InvoiceEntity, facturas),
    renglones: await guardar(dataSource, InvoiceItemEntity, renglones),
    series: await guardar(dataSource, InvoiceSequenceEntity, series),
  };
}

/** Retira cobros, caja y facturas de los negocios sembrados. */
export async function limpiarPayment(
  dataSource: DataSource,
  negocios: string[]
) {
  for (const tabla of [
    "invoices",
    "cash_sessions",
    "payments",
    "invoice_sequences",
  ]) {
    await borrarPorNegocio(dataSource, tabla, negocios);
  }
  // Hijas sin negocio propio: se van con su padre.
  await borrarHuerfanas(dataSource, "invoice_items", "invoice_id", "invoices");
  await borrarHuerfanas(
    dataSource,
    "cash_movements",
    "cash_session_id",
    "cash_sessions"
  );
  await borrarHuerfanas(dataSource, "payment_splits", "payment_id", "payments");
}
