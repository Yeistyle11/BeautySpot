"use client";

import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { api } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { logger } from "@/lib/logger";
import { useApi } from "@/lib/swr";
import { useSeededForm } from "@/lib/use-seeded-form";
import {
  availabilitySlotSchema,
  cambiosDeTarifas,
  DAYS_MAP,
  filasDeTarifas,
  servicioDelCatalogoSchema,
  tarifaSchema,
  TRAMO_POR_DEFECTO,
  type AvailabilitySlot,
  type DayHours,
  type FilaDeTarifa,
  type Professional,
  type ServicioDelCatalogo,
} from "./schemas";

const SERVICES_KEY = "/core/services";

/** La semana en blanco, con los siete dias sin tramos. */
function semanaVacia(): Record<number, DayHours> {
  return Object.fromEntries(DAYS_MAP.map((d) => [d.value, []]));
}

/** Horario por defecto: laborables de 8 a 18, fin de semana cerrado. */
function defaultWeek(): Record<number, DayHours> {
  return Object.fromEntries(
    DAYS_MAP.map((d) => [
      d.value,
      d.value >= 1 && d.value <= 5 ? [TRAMO_POR_DEFECTO] : [],
    ])
  );
}

/** Reparte los tramos del backend por dia; los dias sin tramos son libres. */
function semanaDeTramos(slots: AvailabilitySlot[]): Record<number, DayHours> {
  const semana = semanaVacia();
  slots.forEach((slot) => {
    if (slot.active === false) return;
    semana[slot.dayOfWeek] = [
      ...(semana[slot.dayOfWeek] ?? []),
      { startTime: slot.startTime, endTime: slot.endTime },
    ];
  });
  return semana;
}

/**
 * Horario semanal de un profesional. La semana se pide por SWR con la ficha
 * abierta como clave, asi que abrir dos profesionales seguidos no puede sembrar
 * el formulario con la respuesta del anterior.
 */
export function useHorarioDeProfesional() {
  const [profesional, setProfesional] = useState<Professional | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [semana, setSemana] = useState<Record<number, DayHours>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const { data: tramos, error: errorDeCarga } = useApi<AvailabilitySlot[]>(
    profesional
      ? `/booking/professionals/${profesional.id}/availability`
      : null,
    undefined,
    z.array(availabilitySlotSchema)
  );

  const semanaGuardada = useMemo(() => {
    if (!profesional) return null;
    // Sin horario guardado se propone el estandar, en vez de dejar el
    // formulario en blanco.
    if (errorDeCarga) return defaultWeek();
    return tramos ? semanaDeTramos(tramos) : null;
  }, [profesional, tramos, errorDeCarga]);

  const volverASembrar = useSeededForm(semanaGuardada, setSemana);

  /** Abre el horario de un profesional con su semana cargada. */
  const abrir = useCallback(
    (p: Professional) => {
      volverASembrar();
      setSemana(semanaVacia());
      setError("");
      setProfesional(p);
      setAbierto(true);
    },
    [volverASembrar]
  );

  /** Cierra el dialogo y suelta la semana que tenia pedida. */
  const cerrar = useCallback(() => {
    setAbierto(false);
    setProfesional(null);
  }, []);

  /** Guarda la semana; un dia sin tramos es un dia libre y no se envia. */
  const guardar = useCallback(async () => {
    if (!profesional) return;
    setGuardando(true);
    setError("");
    try {
      const slots = Object.entries(semana).flatMap(([dia, tramosDelDia]) =>
        tramosDelDia.map((tramo) => ({
          dayOfWeek: Number(dia),
          startTime: tramo.startTime,
          endTime: tramo.endTime,
        }))
      );
      await api.post(`/booking/professionals/${profesional.id}/availability`, {
        slots,
      });
      cerrar();
    } catch (err) {
      logger.error(err);
      // El motivo se muestra en el dialogo, junto a los campos a corregir.
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }, [cerrar, profesional, semana]);

  return {
    profesional,
    abierto,
    abrir,
    cerrar,
    semana,
    setSemana,
    guardando,
    error,
    guardar,
  };
}

/**
 * Servicios y tarifas de un profesional. Las dos mitades —el catalogo del
 * negocio y lo que ya tiene asignado— se piden por SWR con la ficha abierta
 * como clave; las filas solo se pueden armar con las dos.
 */
export function useServiciosDeProfesional() {
  const [profesional, setProfesional] = useState<Professional | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaDeTarifa[]>([]);
  const [filasCargadas, setFilasCargadas] = useState<FilaDeTarifa[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const { data: catalogo, error: errorDeCatalogo } = useApi<
    ServicioDelCatalogo[]
  >(
    profesional ? SERVICES_KEY : null,
    undefined,
    z.array(servicioDelCatalogoSchema)
  );
  const { data: asignados, error: errorDeTarifas } = useApi(
    profesional ? `/core/professionals/${profesional.id}/services` : null,
    undefined,
    z.array(tarifaSchema)
  );

  // Un servicio dado de baja no se ofrece para asignar; el que ya lo tuviera
  // asignado lo conserva hasta que alguien lo quite.
  const servicios = useMemo(
    () => (catalogo ?? []).filter((s) => s.active),
    [catalogo]
  );

  const filasIniciales = useMemo(() => {
    if (!profesional || !catalogo || !asignados) return null;
    return filasDeTarifas(servicios, asignados);
  }, [asignados, catalogo, profesional, servicios]);

  const volverASembrar = useSeededForm(filasIniciales, (iniciales) => {
    setFilas(iniciales);
    setFilasCargadas(iniciales);
  });

  const fallo = errorDeCatalogo ?? errorDeTarifas;
  const cargando = !!profesional && !filasIniciales && !fallo;

  /** Abre los servicios de un profesional. */
  const abrir = useCallback(
    (p: Professional) => {
      volverASembrar();
      setFilas([]);
      setFilasCargadas([]);
      setError("");
      setProfesional(p);
      setAbierto(true);
    },
    [volverASembrar]
  );

  /** Cierra el dialogo sin guardar los cambios. */
  const cerrar = useCallback(() => {
    setAbierto(false);
    setProfesional(null);
  }, []);

  /** Aplica solo las asignaciones que hayan cambiado. */
  const guardar = useCallback(async () => {
    if (!profesional) return;
    const cambios = cambiosDeTarifas(filasCargadas, filas);

    // Sin cambios no se llama al servidor: reasignar lo mismo escribiria en la
    // ficha de todos modos.
    if (cambios.asignar.length === 0 && cambios.quitar.length === 0) {
      cerrar();
      return;
    }

    setGuardando(true);
    setError("");
    try {
      const ruta = `/core/professionals/${profesional.id}/services`;
      // En serie y no en paralelo: son pocas y asi el primer fallo deja el
      // resto sin tocar, en vez de a medias sin saber por donde iba.
      for (const asignacion of cambios.asignar) {
        await api.post(ruta, asignacion);
      }
      for (const serviceId of cambios.quitar) {
        await api.delete(`${ruta}/${serviceId}`);
      }
      cerrar();
    } catch (err) {
      logger.error(err);
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }, [cerrar, filas, filasCargadas, profesional]);

  return {
    profesional,
    abierto,
    abrir,
    cerrar,
    servicios,
    filas,
    setFilas,
    cargando,
    guardando,
    error: error || (fallo ? mensajeDeError(fallo) : ""),
    guardar,
  };
}
