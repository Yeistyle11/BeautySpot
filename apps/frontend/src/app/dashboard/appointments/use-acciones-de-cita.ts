"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { revalidatePrefix } from "@/lib/swr";
import { useToast } from "@/components/ui/toast";
import {
  APPOINTMENTS_KEY,
  MOTIVOS_DE_CANCELACION,
  type Appointment,
} from "./schemas";

/**
 * Acciones sobre una cita ya agendada —confirmar, cancelar con motivo, marcar
 * ausencia y reagendar— junto al estado de los dos dialogos que las piden.
 */
export function useAccionesDeCita() {
  const toast = useToast();

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState<string>(
    MOTIVOS_DE_CANCELACION[0].value
  );
  const [notaCancelacion, setNotaCancelacion] = useState("");
  const [reagendando, setReagendando] = useState<Appointment | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [errorAlMover, setErrorAlMover] = useState("");

  /** Lanza una accion del backend sobre la cita y revalida la agenda. */
  const ejecutar = useCallback(
    async (id: string, accion: string, cuerpo: unknown = {}) => {
      try {
        await api.post(`${APPOINTMENTS_KEY}/${id}/${accion}`, cuerpo);
        await revalidatePrefix(APPOINTMENTS_KEY);
      } catch (err) {
        logger.error(err);
        toast.error(mensajeDeError(err));
      }
    },
    [toast]
  );

  /** Confirma una cita pendiente. */
  const confirmar = useCallback(
    (id: string) => ejecutar(id, "confirm"),
    [ejecutar]
  );

  /** Marca que el cliente no se presento. */
  const marcarAusencia = useCallback(
    (id: string) => ejecutar(id, "no-show"),
    [ejecutar]
  );

  /** Abre el dialogo de cancelacion: el motivo se pide antes de cancelar. */
  const pedirCancelacion = useCallback((id: string) => setCancelandoId(id), []);

  /** Cierra el dialogo de cancelacion sin cancelar nada. */
  const cerrarCancelacion = useCallback(() => setCancelandoId(null), []);

  /** Cancela la cita con el motivo y la nota elegidos. */
  const confirmarCancelacion = useCallback(async () => {
    if (!cancelandoId) return;
    await ejecutar(cancelandoId, "cancel", {
      motivo: motivoCancelacion,
      nota: notaCancelacion || undefined,
    });
    setCancelandoId(null);
    setMotivoCancelacion(MOTIVOS_DE_CANCELACION[0].value);
    setNotaCancelacion("");
  }, [cancelandoId, ejecutar, motivoCancelacion, notaCancelacion]);

  /** Abre el dialogo para mover una cita a otro hueco. */
  const abrirReagendar = useCallback((cita: Appointment) => {
    setErrorAlMover("");
    setReagendando(cita);
  }, []);

  /** Cierra el dialogo de reagendado. */
  const cerrarReagendar = useCallback(() => setReagendando(null), []);

  // Reagendar no pasa por `ejecutar`: es un PATCH y su fallo se lee en el
  // dialogo, junto al hueco que se acaba de elegir.
  /** Mueve la cita al dia y la hora elegidos. */
  const confirmarReagendado = useCallback(
    async (date: string, startTime: string) => {
      if (!reagendando) return;
      setMoviendo(true);
      setErrorAlMover("");
      try {
        await api.patch(`${APPOINTMENTS_KEY}/${reagendando.id}/reschedule`, {
          date,
          startTime,
        });
        await revalidatePrefix(APPOINTMENTS_KEY);
        setReagendando(null);
        toast.exito("Cita reagendada");
      } catch (err) {
        logger.error(err);
        setErrorAlMover(mensajeDeError(err, "No se pudo reagendar la cita"));
      } finally {
        setMoviendo(false);
      }
    },
    [reagendando, toast]
  );

  return {
    confirmar,
    marcarAusencia,
    pedirCancelacion,
    cancelandoId,
    cerrarCancelacion,
    motivoCancelacion,
    setMotivoCancelacion,
    notaCancelacion,
    setNotaCancelacion,
    confirmarCancelacion,
    reagendando,
    abrirReagendar,
    cerrarReagendar,
    confirmarReagendado,
    moviendo,
    errorAlMover,
  };
}
