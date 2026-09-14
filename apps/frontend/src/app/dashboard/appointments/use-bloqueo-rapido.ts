"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import {
  blockedSlotsPath,
  emptyForm as emptyBlockedSlotForm,
  toBlockedSlotPayload,
  type BlockedSlot,
} from "../blocked-slots/schemas";

/** Media hora despues, que es lo que dura por defecto un bloqueo rapido. */
function sumarMediaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

/**
 * Bloqueo de agenda creado desde un hueco de la vista dia. `dia` es la fecha
 * que se esta viendo y `recargar` revalida los bloqueos ya pintados.
 */
export function useBloqueoRapido(
  dia: string,
  recargar: () => Promise<unknown>
) {
  const toast = useToast();
  const [profesional, setProfesional] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBlockedSlotForm);
  const [guardando, setGuardando] = useState(false);

  /** Abre el formulario sembrado con el hueco que se pulso. */
  const abrir = useCallback(
    (professionalId: string, hora: string) => {
      setProfesional(professionalId);
      setForm({
        ...emptyBlockedSlotForm,
        date: dia,
        startTime: hora,
        endTime: sumarMediaHora(hora),
      });
    },
    [dia]
  );

  /** Cierra el formulario sin bloquear nada. */
  const cerrar = useCallback(() => setProfesional(null), []);

  /** Crea el bloqueo y recarga los que ya se pintaban. */
  const enviar = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profesional) return;
      setGuardando(true);
      try {
        const creados = await api.post<BlockedSlot[]>(
          blockedSlotsPath(profesional),
          toBlockedSlotPayload(form)
        );
        setProfesional(null);
        await recargar();
        toast.exito(
          creados.length > 1
            ? `Se bloquearon ${creados.length} días`
            : "Agenda bloqueada"
        );
      } catch (err) {
        logger.error(err);
        toast.error(mensajeDeError(err));
      } finally {
        setGuardando(false);
      }
    },
    [form, profesional, recargar, toast]
  );

  return { profesional, abrir, cerrar, form, setForm, guardando, enviar };
}
