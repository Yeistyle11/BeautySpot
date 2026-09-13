"use client";

// Pagina de bloqueos de agenda: vacaciones, descansos y ausencias de cada
// profesional, sueltos o repetidos.
import { useState, useMemo } from "react";
import { z } from "zod";
import { CalendarOff, Plus, Trash2, Repeat, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import { useApi } from "@/lib/swr";
import { LoadingState } from "@/components/ui/loading-state";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
} from "@/components/ui/tabla-de-registros";
import { useCrudResource } from "@/lib/use-crud-resource";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { mensajeDeError } from "@/lib/error-message";
import { formatDate, formatTime } from "@/lib/utils";
import { BlockedSlotFormDialog } from "./blocked-slot-form-dialog";
import {
  blockedSlotSchema,
  blockedSlotsPath,
  emptyForm,
  professionalSchema,
  PROFESSIONALS_KEY,
  toBlockedSlotPayload,
  type BlockedSlot,
  type Professional,
} from "./schemas";

/** Bloqueos futuros de todo el negocio; el equipo se filtra en la pantalla. */
const BLOQUEOS_DEL_NEGOCIO = "/booking/blocked-slots";

const COLUMNAS = [
  { label: "Profesional" },
  { label: "Día" },
  { label: "Franja" },
  { label: "Motivo", ocultaEnMovil: true },
  { label: "Repetición" },
];

export default function BlockedSlotsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const puedeCrear = canDo(role, "blocked_slots_create");
  const puedeBorrar = canDo(role, "blocked_slots_delete");

  const { data: profesionales } = useApi<Professional[]>(
    PROFESSIONALS_KEY,
    undefined,
    z.array(professionalSchema)
  );

  /** Filtro del listado; vacio muestra los de todo el equipo. */
  const [filtroProfesional, setFiltroProfesional] = useState("");
  /** A quien se le bloquea la agenda al crear; lo pide el propio dialogo. */
  const [profesionalId, setProfesionalId] = useState("");

  // El listado trae los bloqueos futuros de todo el negocio; el filtro por
  // profesional se aplica aqui.
  const {
    items: todos,
    isLoading,
    error,
    reload,
  } = useCrudResource<BlockedSlot>({
    listKey: BLOQUEOS_DEL_NEGOCIO,
    basePath: BLOQUEOS_DEL_NEGOCIO,
    schema: z.array(blockedSlotSchema),
  });

  const nombreDeProfesional = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const p of profesionales ?? []) mapa[p.id] = p.name;
    return mapa;
  }, [profesionales]);

  const bloqueos = useMemo(
    () =>
      filtroProfesional
        ? todos.filter((b) => b.professionalId === filtroProfesional)
        : todos,
    [todos, filtroProfesional]
  );

  /** Cuantos bloqueos futuros tiene cada persona, para el filtro. */
  const cuentaPorProfesional = useMemo(() => {
    const cuenta: Record<string, number> = {};
    for (const b of todos) {
      cuenta[b.professionalId] = (cuenta[b.professionalId] ?? 0) + 1;
    }
    return cuenta;
  }, [todos]);

  const [dialogo, setDialogo] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState<BlockedSlot | null>(null);
  const [borrarSerie, setBorrarSerie] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const creados = await api.post<BlockedSlot[]>(
        blockedSlotsPath(profesionalId),
        toBlockedSlotPayload(form)
      );
      setDialogo(false);
      setForm(emptyForm);
      await reload();
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
  };

  const borrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      const ruta = `${blockedSlotsPath(aBorrar.professionalId)}/${aBorrar.id}`;
      await api.delete(borrarSerie ? `${ruta}/serie` : ruta);
      setABorrar(null);
      await reload();
      toast.exito(borrarSerie ? "Serie eliminada" : "Bloqueo eliminado");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bloqueos de agenda</h1>
          <p className="text-muted-foreground text-sm">
            Vacaciones, descansos y ausencias. Un bloqueo impide reservar en esa
            franja.
          </p>
        </div>
        {puedeCrear && (
          <Button onClick={() => setDialogo(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Bloquear agenda
          </Button>
        )}
      </div>

      {/* Filtro por profesional. Cada opcion lleva cuantos bloqueos tiene. */}
      {(profesionales ?? []).length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4 shrink-0" />
          <Select
            value={filtroProfesional}
            onChange={(e) => setFiltroProfesional(e.target.value)}
            aria-label="Filtrar los bloqueos por profesional"
            className="h-9 w-auto min-w-[260px]"
          >
            <option value="">Todo el equipo ({todos.length})</option>
            {(profesionales ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({cuentaPorProfesional[p.id] ?? 0})
              </option>
            ))}
          </Select>
        </div>
      )}

      {error ? (
        <ErrorDeCarga
          error={error}
          recurso="los bloqueos"
          onReintentar={reload}
        />
      ) : isLoading ? (
        <LoadingState recurso="los bloqueos" />
      ) : bloqueos.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          titulo={
            filtroProfesional ? "Sin bloqueos de esta persona" : "Sin bloqueos"
          }
          descripcion={
            filtroProfesional
              ? "Su agenda está libre en todas las fechas futuras."
              : "Nadie del equipo tiene la agenda bloqueada próximamente."
          }
        />
      ) : (
        <TablaDeRegistros titulo="Bloqueos de agenda" columnas={COLUMNAS}>
          {bloqueos.map((b) => (
            <FilaDeTabla
              key={b.id}
              acciones={
                puedeBorrar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => {
                      setABorrar(b);
                      setBorrarSerie(false);
                    }}
                    aria-label={`Eliminar el bloqueo del ${formatDate(b.date)}`}
                    title="Eliminar bloqueo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )
              }
            >
              <CeldaPrincipal
                inicial={(nombreDeProfesional[b.professionalId] || "?").charAt(
                  0
                )}
                titulo={
                  nombreDeProfesional[b.professionalId] ||
                  b.professionalId.slice(0, 8)
                }
              />
              <CeldaDeTabla apagada>{formatDate(b.date)}</CeldaDeTabla>
              <CeldaDeTabla apagada>
                <span className="whitespace-nowrap">
                  {formatTime(b.startTime)}–{formatTime(b.endTime)}
                </span>
              </CeldaDeTabla>
              <CeldaDeTabla apagada ocultaEnMovil>
                {b.reason || "—"}
              </CeldaDeTabla>
              <CeldaDeTabla>
                {b.serieId && (
                  <Badge variant="secondary">
                    <Repeat className="mr-1 h-3 w-3" />
                    Se repite
                  </Badge>
                )}
              </CeldaDeTabla>
            </FilaDeTabla>
          ))}
        </TablaDeRegistros>
      )}

      <BlockedSlotFormDialog
        profesionales={profesionales ?? []}
        profesionalId={profesionalId}
        onProfesionalChange={setProfesionalId}
        open={dialogo}
        onClose={() => setDialogo(false)}
        form={form}
        onFormChange={setForm}
        onSubmit={crear}
        guardando={guardando}
      />

      {/* Un bloqueo repetido se puede levantar solo ese día o entero: son dos
          intenciones distintas y conviene que se elijan a mano. */}
      <ConfirmDialog
        open={aBorrar !== null}
        onClose={() => setABorrar(null)}
        onConfirm={borrar}
        pending={borrando}
        pendingLabel="Eliminando..."
        variant="destructive"
        title="Eliminar bloqueo"
        confirmLabel={borrarSerie ? "Eliminar la serie" : "Eliminar este día"}
      >
        <div className="space-y-3">
          <p>
            {aBorrar?.serieId
              ? "Este bloqueo se repite. Puedes quitar solo este día o la serie completa."
              : "¿Eliminar este bloqueo? La franja vuelve a quedar reservable."}
          </p>
          {aBorrar?.serieId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={borrarSerie}
                onChange={(e) => setBorrarSerie(e.target.checked)}
              />
              Eliminar toda la serie
            </label>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
