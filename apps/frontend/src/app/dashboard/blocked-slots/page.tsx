"use client";

// Pagina de bloqueos de agenda: vacaciones, descansos y ausencias de cada
// profesional, sueltos o repetidos.
import { useState } from "react";
import { z } from "zod";
import { CalendarOff, Plus, Trash2, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { mensajeDeError } from "@/lib/error-message";
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

export default function BlockedSlotsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const puedeCrear = canDo(role, "blocked_slots_create");
  const puedeBorrar = canDo(role, "blocked_slots_delete");

  const { data: profesionales, isLoading: cargandoEquipo } = useApi<
    Professional[]
  >(PROFESSIONALS_KEY, undefined, z.array(professionalSchema));

  const [profesionalId, setProfesionalId] = useState("");

  // Los bloqueos cuelgan del profesional, asi que hasta elegir uno no hay nada
  // que pedir: la clave a null deja la peticion sin lanzar.
  const {
    items: bloqueos,
    isLoading,
    error,
    reload,
  } = useCrudResource<BlockedSlot>({
    listKey: profesionalId ? blockedSlotsPath(profesionalId) : "",
    basePath: profesionalId ? blockedSlotsPath(profesionalId) : "",
    schema: z.array(blockedSlotSchema),
  });

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
      const ruta = `${blockedSlotsPath(profesionalId)}/${aBorrar.id}`;
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
        {puedeCrear && profesionalId && (
          <Button onClick={() => setDialogo(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Bloquear agenda
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Field label="Profesional">
            <Select
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
              disabled={cargandoEquipo}
            >
              <option value="">Selecciona un profesional</option>
              {(profesionales ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      {!profesionalId ? (
        <EmptyState
          icon={CalendarOff}
          titulo="Elige un profesional"
          descripcion="Los bloqueos son de la agenda de cada persona del equipo."
        />
      ) : error ? (
        <ErrorDeCarga
          error={error}
          recurso="los bloqueos"
          onReintentar={reload}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : bloqueos.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          titulo="Sin bloqueos"
          descripcion="Su agenda está libre en todas las fechas futuras."
        />
      ) : (
        <div className="space-y-3">
          {bloqueos.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {b.date} · {b.startTime}–{b.endTime}
                  </p>
                  {b.reason && (
                    <p className="text-muted-foreground text-sm">{b.reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {b.serieId && (
                    <Badge variant="secondary">
                      <Repeat className="mr-1 h-3 w-3" />
                      Se repite
                    </Badge>
                  )}
                  {puedeBorrar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setABorrar(b);
                        setBorrarSerie(false);
                      }}
                      aria-label={`Eliminar el bloqueo del ${b.date}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BlockedSlotFormDialog
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
