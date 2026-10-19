"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { motivoParaNoCobrar } from "@/lib/caja-abierta";
import { descargarPdf } from "@/lib/descargar";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { revalidatePrefix } from "@/lib/swr";
import { useToast } from "@/components/ui/toast";
import {
  cobroDeLaCita,
  emptyPaymentDraft,
  type PaymentDraft,
} from "./complete-appointment-dialog";
import { cobroParaEnviar, mediosDelCobro } from "../payments/schemas";
import { APPOINTMENTS_KEY, type Appointment } from "./schemas";

/** Factura recién emitida: lo que hace falta para descargarla. */
interface FacturaEmitida {
  id: string;
  number: string;
}

/** Cierre de una cita atendida y, si se pide, su cobro y su factura. */
export function useCierreDeCita(puedeFacturar = false) {
  const toast = useToast();
  const [cita, setCita] = useState<Appointment | null>(null);
  const [cobro, setCobro] = useState<PaymentDraft>(emptyPaymentDraft);
  const [cerrando, setCerrando] = useState(false);
  /** Identifica el intento de cobro; se renueva al abrir el dialogo. */
  const solicitudId = useRef("");

  /** Abre el dialogo de cierre con el cobro de la cita por rellenar. */
  const abrir = useCallback((aCerrar: Appointment) => {
    solicitudId.current = crypto.randomUUID();
    setCita(aCerrar);
    setCobro(cobroDeLaCita(aCerrar));
  }, []);

  /** Cierra el dialogo sin completar la cita. */
  const cancelar = useCallback(() => setCita(null), []);

  /** Emite la factura del cobro y avisa con la opción de descargarla. */
  const facturar = useCallback(
    async (paymentId: string) => {
      try {
        const factura = await api.post<FacturaEmitida>("/payment/invoices", {
          paymentId,
        });
        toast.exito(
          `Cita completada, cobrada y facturada (${factura.number})`,
          {
            etiqueta: "Descargar",
            alPulsar: () =>
              descargarPdf(
                `/payment/invoices/${factura.id}/pdf`,
                `factura-${factura.number}.pdf`
              ).catch((err) => toast.error(mensajeDeError(err))),
          }
        );
      } catch (err) {
        logger.error(err);
        toast.error(
          `Cita completada y cobrada, pero la factura no se pudo emitir: ${mensajeDeError(err)}. Puedes emitirla desde Facturas.`
        );
      }
    },
    [toast]
  );

  /** Completa la cita y, si `conCobro`, registra el pago y lo factura. */
  const confirmar = useCallback(
    async (conCobro: boolean) => {
      if (!cita) return;
      setCerrando(true);
      try {
        if (conCobro && mediosDelCobro(cobro).includes("CASH")) {
          const motivo = await motivoParaNoCobrar("CASH");
          if (motivo) {
            toast.error(motivo);
            return;
          }
        }

        await api.post(`${APPOINTMENTS_KEY}/${cita.id}/complete`, {});

        if (conCobro) {
          const pago = await api.post<{ id: string }>(
            "/payment/payments",
            cobroParaEnviar(cobro, solicitudId.current)
          );

          if (puedeFacturar && cobro.facturar) {
            await facturar(pago.id);
            await revalidatePrefix("/payment/invoices");
          } else {
            toast.exito("Cita completada y cobrada");
          }
        }

        await revalidatePrefix(APPOINTMENTS_KEY);
        await revalidatePrefix("/payment/payments");
        setCita(null);
      } catch (err) {
        logger.error(err);
        toast.error(mensajeDeError(err));
      } finally {
        setCerrando(false);
      }
    },
    [cita, cobro, toast, puedeFacturar, facturar]
  );

  return { cita, abrir, cancelar, cobro, setCobro, cerrando, confirmar };
}
