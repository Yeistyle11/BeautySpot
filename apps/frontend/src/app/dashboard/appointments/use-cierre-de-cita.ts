"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { motivoParaNoCobrar } from "@/lib/caja-abierta";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { revalidatePrefix } from "@/lib/swr";
import { useToast } from "@/components/ui/toast";
import {
  emptyPaymentDraft,
  type PaymentDraft,
} from "./complete-appointment-dialog";
import { APPOINTMENTS_KEY, type Appointment } from "./schemas";

/**
 * Cierre de una cita atendida y, si se pide, su cobro. Son dos escrituras
 * encadenadas sin transaccion: si falla la del pago, la cita queda completada y
 * el cobro se registra despues desde Pagos, asi que la caja se comprueba antes.
 */
export function useCierreDeCita() {
  const toast = useToast();
  const [cita, setCita] = useState<Appointment | null>(null);
  const [cobro, setCobro] = useState<PaymentDraft>(emptyPaymentDraft);
  const [cerrando, setCerrando] = useState(false);

  /** Abre el dialogo de cierre con el cobro en blanco. */
  const abrir = useCallback((aCerrar: Appointment) => {
    setCita(aCerrar);
    setCobro(emptyPaymentDraft);
  }, []);

  /** Cierra el dialogo sin completar la cita. */
  const cancelar = useCallback(() => setCita(null), []);

  /** Completa la cita y, si `conCobro`, registra el pago. */
  const confirmar = useCallback(
    async (conCobro: boolean) => {
      if (!cita) return;
      setCerrando(true);
      try {
        if (conCobro) {
          const motivo = await motivoParaNoCobrar(cobro.method);
          if (motivo) {
            toast.error(motivo);
            return;
          }
        }

        await api.post(`${APPOINTMENTS_KEY}/${cita.id}/complete`, {});

        if (conCobro) {
          await api.post("/payment/payments", {
            appointmentId: cita.id,
            clientId: cita.clientId,
            amount: cita.totalAmount,
            method: cobro.method,
            reference: cobro.reference || undefined,
            notes: cobro.notes || undefined,
          });
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
    [cita, cobro, toast]
  );

  return { cita, abrir, cancelar, cobro, setCobro, cerrando, confirmar };
}
