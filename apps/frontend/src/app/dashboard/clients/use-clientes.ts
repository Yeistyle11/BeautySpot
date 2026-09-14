"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { mensajeDeError, repartirFalloAlGuardar } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { emptyClientForm, type ClientForm } from "./client-form-dialog";
import {
  cambiosDelCliente,
  clientSchema,
  CLIENTS_KEY,
  type Client,
} from "./schemas";

/** Los campos del formulario, tal como se leen de una ficha guardada. */
export function comoFormulario(client: Client): ClientForm {
  return {
    name: client.name,
    email: client.email || "",
    phone: client.phone || "",
    notes: client.notes || "",
    birthDate: client.birthDate || "",
  };
}

/** Alta de una ficha de cliente desde el listado. */
export function useAltaDeCliente(crear: (body: unknown) => Promise<unknown>) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyClientForm);
  const [guardando, setGuardando] = useState(false);

  /** Abre el formulario de alta en blanco. */
  const abrir = useCallback(() => setAbierto(true), []);

  /** Cierra el formulario sin dar de alta nada. */
  const cerrar = useCallback(() => setAbierto(false), []);

  /** Da de alta la ficha con lo tecleado. */
  const enviar = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGuardando(true);
      try {
        await crear({
          name: form.name.trim(),
          email: form.email || undefined,
          phone: form.phone || undefined,
          birthDate: form.birthDate || undefined,
        });
        setForm(emptyClientForm);
        setAbierto(false);
      } catch (err) {
        logger.error(err);
        toast.error(mensajeDeError(err));
      } finally {
        setGuardando(false);
      }
    },
    [crear, form, toast]
  );

  return { abierto, abrir, cerrar, form, setForm, guardando, enviar };
}

/**
 * Edicion de una ficha con control de concurrencia: se guarda la version con la
 * que se abrio el formulario y solo se envia lo que el usuario haya tocado, de
 * modo que el servidor pueda avisar si otra persona la cambio mientras tanto.
 */
export function useEdicionDeCliente({
  actualizar,
  recargarCliente,
  alGuardar,
}: {
  actualizar: (id: string, body: unknown) => Promise<unknown>;
  recargarCliente: (id: string) => Promise<Client | null>;
  alGuardar: (guardada: Client) => void;
}) {
  const toast = useToast();
  const enBlanco = { ...emptyClientForm, notes: "" };
  const [abierto, setAbierto] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(enBlanco);
  // La ficha tal como se cargo, para enviar en el guardado solo lo modificado.
  const [original, setOriginal] = useState<ClientForm>(enBlanco);
  const [version, setVersion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState("");

  /** Abre el formulario sembrado con la ficha y su version. */
  const abrir = useCallback((client: Client) => {
    const cargado = comoFormulario(client);
    setId(client.id);
    setForm(cargado);
    setOriginal(cargado);
    setVersion(client.updatedAt);
    setConflicto("");
    setAbierto(true);
  }, []);

  /** Cierra el formulario descartando lo escrito. */
  const cerrar = useCallback(() => {
    setAbierto(false);
    setId(null);
  }, []);

  /** Cambia lo escrito por lo que hay guardado, dejando el formulario abierto. */
  const recargar = useCallback(async () => {
    if (!id) return;
    const fresca = await recargarCliente(id);
    if (!fresca) return;
    const cargada = comoFormulario(fresca);
    setForm(cargada);
    setOriginal(cargada);
    setVersion(fresca.updatedAt);
    setConflicto("");
  }, [id, recargarCliente]);

  /** Guarda solo los campos modificados. */
  const enviar = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      const cambios = cambiosDelCliente(original, form);
      // Sin cambios no hay nada que mandar, y un PATCH vacio solo serviria para
      // pisar la ficha con lo que esta pestana tenia cargado.
      if (Object.keys(cambios).length === 0) {
        cerrar();
        return;
      }
      setGuardando(true);
      setConflicto("");
      try {
        const guardada = clientSchema.parse(
          await actualizar(id, { ...cambios, updatedAt: version ?? undefined })
        );
        cerrar();
        alGuardar(guardada);
      } catch (err) {
        logger.error(err);
        // El formulario se queda abierto con lo escrito: hay algo que decidir,
        // y un aviso que se va solo no da tiempo a decidirlo.
        repartirFalloAlGuardar(err, setConflicto, toast.error);
      } finally {
        setGuardando(false);
      }
    },
    [actualizar, alGuardar, cerrar, form, id, original, toast, version]
  );

  return {
    abierto,
    id,
    abrir,
    cerrar,
    form,
    setForm,
    guardando,
    conflicto,
    recargar,
    enviar,
  };
}

/**
 * Fusion de dos fichas de la misma persona: la elegida sobrevive y absorbe a la
 * otra. El fallo se lee en el dialogo, porque pide revisar antes de reintentar.
 */
export function useFusionDeClientes(
  recargarClientes: () => Promise<unknown>,
  alFusionar: () => void
) {
  const toast = useToast();
  const [superviviente, setSuperviviente] = useState<Client | null>(null);
  const [absorbidoId, setAbsorbidoId] = useState("");
  const [fusionando, setFusionando] = useState(false);
  const [error, setError] = useState("");

  /** Abre la fusion sobre la ficha que va a sobrevivir. */
  const abrir = useCallback((client: Client) => {
    setSuperviviente(client);
    setAbsorbidoId("");
    setError("");
  }, []);

  /** Cierra el dialogo sin fusionar nada. */
  const cerrar = useCallback(() => setSuperviviente(null), []);

  /** Fusiona la ficha absorbida dentro de la superviviente. */
  const confirmar = useCallback(async () => {
    if (!superviviente || !absorbidoId) return;
    setFusionando(true);
    setError("");
    try {
      await api.post(`${CLIENTS_KEY}/${superviviente.id}/merge`, {
        absorbidoId,
      });
      setSuperviviente(null);
      alFusionar();
      await recargarClientes();
      toast.exito("Fichas fusionadas");
    } catch (err) {
      logger.error(err);
      setError(mensajeDeError(err));
    } finally {
      setFusionando(false);
    }
  }, [absorbidoId, alFusionar, recargarClientes, superviviente, toast]);

  return {
    superviviente,
    abrir,
    cerrar,
    absorbidoId,
    setAbsorbidoId,
    fusionando,
    error,
    confirmar,
  };
}

/** Derecho de supresion sobre una ficha, previa confirmacion explicita. */
export function useSupresionDeCliente(
  recargarClientes: () => Promise<unknown>,
  alSuprimir: () => void
) {
  const toast = useToast();
  const [cliente, setCliente] = useState<Client | null>(null);
  const [suprimiendo, setSuprimiendo] = useState(false);

  /** Pide confirmacion antes de suprimir la ficha. */
  const pedir = useCallback((c: Client) => setCliente(c), []);

  /** Cancela la supresion. */
  const cancelar = useCallback(() => setCliente(null), []);

  /** Anonimiza la ficha de forma irreversible. */
  const confirmar = useCallback(async () => {
    if (!cliente) return;
    setSuprimiendo(true);
    try {
      await api.post(`${CLIENTS_KEY}/${cliente.id}/anonymize`, {});
      await recargarClientes();
      setCliente(null);
      alSuprimir();
      toast.exito("Los datos del cliente se suprimieron");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSuprimiendo(false);
    }
  }, [alSuprimir, cliente, recargarClientes, toast]);

  return { cliente, pedir, cancelar, suprimiendo, confirmar };
}
