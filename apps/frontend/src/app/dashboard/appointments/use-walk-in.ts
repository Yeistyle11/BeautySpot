"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { motivoParaNoCobrar } from "@/lib/caja-abierta";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { revalidatePrefix } from "@/lib/swr";
import { useToast } from "@/components/ui/toast";
import {
  APPOINTMENTS_KEY,
  emptyWalkInForm,
  horaActual,
  walkInParaEnviar,
  type Appointment,
} from "./schemas";

/**
 * Alta de una atencion sin cita previa, con su cobro opcional en el mismo paso.
 * `asignaciones` reparte los servicios entre profesionales.
 */
export function useWalkIn(asignaciones: Record<string, string>) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(emptyWalkInForm);
  const [servicios, setServicios] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  /** Abre el dialogo proponiendo la hora de ahora. */
  const abrir = useCallback(() => {
    setForm({ ...emptyWalkInForm, startTime: horaActual() });
    setServicios([]);
    setError("");
    setAbierto(true);
  }, []);

  /** Cierra el dialogo sin registrar nada. */
  const cerrar = useCallback(() => setAbierto(false), []);

  /** Añade o quita un servicio de la atencion. */
  const alternarServicio = useCallback((id: string) => {
    setServicios((previos) =>
      previos.includes(id) ? previos.filter((s) => s !== id) : [...previos, id]
    );
  }, []);

  /** Registra la atencion y, si se marco cobrar, su pago. */
  const enviar = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGuardando(true);
      setError("");
      try {
        if (form.cobrar) {
          const motivo = await motivoParaNoCobrar(form.metodo);
          if (motivo) {
            // El motivo se lee en el dialogo: el aviso flotante se lo llevaria
            // y hay que corregir algo antes de reintentar.
            setError(motivo);
            return;
          }
        }

        const cita = await api.post<Appointment>(
          `${APPOINTMENTS_KEY}/walk-in`,
          walkInParaEnviar(form, servicios, asignaciones)
        );

        if (form.cobrar) {
          await api.post("/payment/payments", {
            appointmentId: cita.id,
            clientId: cita.clientId,
            amount: cita.totalAmount,
            method: form.metodo,
            reference: form.referencia || undefined,
          });
        }

        setAbierto(false);
        await revalidatePrefix(APPOINTMENTS_KEY);
        await revalidatePrefix("/payment/payments");
        await revalidatePrefix("/payment/cash-register");
        toast.exito("Walk-in registrado");
      } catch (err) {
        logger.error(err);
        setError(mensajeDeError(err));
      } finally {
        setGuardando(false);
      }
    },
    [asignaciones, form, servicios, toast]
  );

  return {
    abierto,
    abrir,
    cerrar,
    form,
    setForm,
    servicios,
    alternarServicio,
    guardando,
    error,
    enviar,
  };
}
