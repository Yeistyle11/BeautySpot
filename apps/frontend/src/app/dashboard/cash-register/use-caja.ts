"use client";

import { useCallback, useState } from "react";
import { mutate } from "swr";
import { api } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";

/** Revalida lo que cambia al abrir o cerrar una sesion de caja. */
export type RecargarCaja = () => Promise<unknown>;

/**
 * Apertura de la caja con el fondo inicial. `recargar` refresca la sesion
 * activa, el historial y sus contadores, que cambian los tres a la vez.
 */
export function useAperturaDeCaja(recargar: RecargarCaja) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [importe, setImporte] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  /** Abre el dialogo de apertura. */
  const abrir = useCallback(() => setAbierto(true), []);

  /** Cierra el dialogo sin abrir caja. */
  const cerrar = useCallback(() => setAbierto(false), []);

  /** Abre la sesion de caja con el fondo tecleado. */
  const confirmar = useCallback(async () => {
    setGuardando(true);
    try {
      await api.post("/payment/cash-register/open", {
        openingAmount: importe ? parseFloat(importe) : 0,
        notes: notas || undefined,
      });
      setAbierto(false);
      setImporte("");
      setNotas("");
      await recargar();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }, [importe, notas, recargar, toast]);

  return {
    abierto,
    abrir,
    cerrar,
    importe,
    setImporte,
    notas,
    setNotas,
    guardando,
    confirmar,
  };
}

/**
 * Entrada o salida de dinero anotada a mano sobre la sesion abierta.
 * `resumenKey` es la clave del resumen que hay que revalidar tras anotarla.
 */
export function useMovimientoDeCaja(
  sesionId: string | undefined,
  resumenKey: string | null
) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState("IN");
  const [importe, setImporte] = useState("");
  const [concepto, setConcepto] = useState("");
  const [guardando, setGuardando] = useState(false);

  /** Abre el dialogo del movimiento. */
  const abrir = useCallback(() => setAbierto(true), []);

  /** Cierra el dialogo sin anotar nada. */
  const cerrar = useCallback(() => setAbierto(false), []);

  /** Anota el movimiento en la sesion abierta. */
  const confirmar = useCallback(async () => {
    if (!sesionId) return;
    setGuardando(true);
    try {
      await api.post(`/payment/cash-register/${sesionId}/movements`, {
        type: tipo,
        amount: parseFloat(importe),
        concept: concepto,
      });
      setAbierto(false);
      setImporte("");
      setConcepto("");
      await mutate(resumenKey);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }, [concepto, importe, resumenKey, sesionId, tipo, toast]);

  /** Un movimiento sin importe o sin concepto no se puede anotar. */
  const completo = !!importe && !!concepto;

  return {
    abierto,
    abrir,
    cerrar,
    tipo,
    setTipo,
    importe,
    setImporte,
    concepto,
    setConcepto,
    guardando,
    completo,
    confirmar,
  };
}

/**
 * Arqueo y cierre de la sesion. Mientras el dialogo esta abierto la pagina tapa
 * el efectivo esperado, para que se cuente el cajon antes de verlo.
 */
export function useCierreDeCaja(
  sesionId: string | undefined,
  recargar: RecargarCaja
) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [importe, setImporte] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  /** Abre el arqueo. */
  const abrir = useCallback(() => setAbierto(true), []);

  /** Cierra el arqueo sin cerrar la caja. */
  const cerrar = useCallback(() => setAbierto(false), []);

  /** Cierra la sesion con el efectivo contado. */
  const confirmar = useCallback(async () => {
    if (!sesionId) return;
    setGuardando(true);
    try {
      await api.post(`/payment/cash-register/${sesionId}/close`, {
        closingAmount: parseFloat(importe),
        notes: notas || undefined,
      });
      setAbierto(false);
      setImporte("");
      setNotas("");
      await recargar();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }, [importe, notas, recargar, sesionId, toast]);

  return {
    abierto,
    abrir,
    cerrar,
    importe,
    setImporte,
    notas,
    setNotas,
    guardando,
    confirmar,
  };
}
