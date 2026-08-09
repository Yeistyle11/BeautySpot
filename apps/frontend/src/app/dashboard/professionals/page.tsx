"use client";

// Pagina del equipo: lista de profesionales con alta, edicion, detalle, horario y baja.
import { useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/utils";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { ProCard } from "./pro-card";
import {
  categorySchema,
  DAYS_MAP,
  TRAMO_POR_DEFECTO,
  emptyForm,
  professionalSchema,
  toProfessionalPayload,
  type AvailabilitySlot,
  type Category,
  type DayHours,
  type Professional,
} from "./schemas";

// Los tres dialogos estan cerrados mientras se navega la lista, que es lo
// habitual: se descargan al abrirlos.
const ProfessionalFormDialog = dynamic(
  () =>
    import("./professional-form-dialog").then((m) => m.ProfessionalFormDialog),
  { ssr: false }
);
const ProfessionalDetailDialog = dynamic(
  () =>
    import("./professional-detail-dialog").then(
      (m) => m.ProfessionalDetailDialog
    ),
  { ssr: false }
);
const ScheduleDialog = dynamic(
  () => import("./schedule-dialog").then((m) => m.ScheduleDialog),
  { ssr: false }
);

const PROFESSIONALS_KEY = "/core/professionals";
const CATEGORIES_KEY = "/core/categories";

/** Semana sin ningun tramo. */
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

function ProfessionalGroup({
  title,
  dotColor,
  items,
  children,
}: {
  title: string;
  dotColor: string;
  items: Professional[];
  children: (p: Professional) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        {title} ({items.length})
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(children)}
      </div>
    </div>
  );
}

export default function ProfessionalsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const {
    items: professionals,
    isLoading: loading,
    error: loadError,
    reload,
    create: createProfessional,
    update: updateProfessional,
    remove: removeProfessional,
  } = useCrudResource<Professional>({
    listKey: PROFESSIONALS_KEY,
    basePath: "/core/professionals",
    schema: z.array(professionalSchema),
  });
  const { data: categoriesData } = useApi<Category[]>(
    CATEGORIES_KEY,
    undefined,
    z.array(categorySchema)
  );
  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);

  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schedulePro, setSchedulePro] = useState<Professional | null>(null);
  const [scheduleHours, setScheduleHours] = useState<Record<number, DayHours>>(
    {}
  );
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // Se recuerda de quien es la ultima peticion de horario en vuelo: abrir dos
  // profesionales seguidos hacia que la respuesta lenta del primero sobrescribiera
  // la semana del segundo.
  const horarioPedidoPara = useRef<string | null>(null);

  /**
   * Abre el dialogo de horario de un profesional. El horario se pide a mano y no
   * con SWR, a diferencia del resto de la pagina, porque no se cachea: es un
   * formulario que se rellena al abrir y se descarta al cerrar.
   */
  const openSchedule = useCallback((p: Professional) => {
    setSchedulePro(p);
    setScheduleDialog(true);
    horarioPedidoPara.current = p.id;
    api
      .get<AvailabilitySlot[]>(`/booking/professionals/${p.id}/availability`)
      .then((slots) => {
        if (horarioPedidoPara.current !== p.id) return;
        // El backend solo devuelve los dias configurados; el resto queda sin
        // tramos para que la semana salga completa en el formulario.
        const week = semanaVacia();
        slots.forEach((slot) => {
          if (slot.active === false) return;
          week[slot.dayOfWeek] = [
            ...(week[slot.dayOfWeek] ?? []),
            { startTime: slot.startTime, endTime: slot.endTime },
          ];
        });
        setScheduleHours(week);
      })
      .catch(() => {
        if (horarioPedidoPara.current !== p.id) return;
        // Si el profesional aun no tiene horario, se propone el estandar en
        // vez de dejar el formulario vacio.
        setScheduleHours(defaultWeek());
      });
  }, []);

  const saveSchedule = async () => {
    if (!schedulePro) return;
    setSavingSchedule(true);
    setScheduleError("");
    try {
      // Un dia sin tramos es un dia libre, asi que no se envia.
      const slots = Object.entries(scheduleHours).flatMap(([day, tramos]) =>
        tramos.map((tramo) => ({
          dayOfWeek: Number(day),
          startTime: tramo.startTime,
          endTime: tramo.endTime,
        }))
      );

      await api.post(`/booking/professionals/${schedulePro.id}/availability`, {
        slots,
      });
      setScheduleDialog(false);
    } catch (err) {
      logger.error(err);
      // El motivo se muestra en el dialogo, junto a los campos a corregir.
      setScheduleError(mensajeDeError(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  const startEdit = useCallback((p: Professional) => {
    setEditId(p.id);
    setViewId(null);
    setForm({
      name: p.name || "",
      bio: p.bio || "",
      specialties: p.specialties?.join(", ") || "",
      yearsExp: String(p.yearsExp || 0),
      category: p.category || "",
      categoryId: p.categoryId || "",
      photo: p.photo || "",
      active: String(p.active),
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProfessional(toProfessionalPayload(form, categories));
      setShowCreate(false);
      setForm(emptyForm);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      await updateProfessional(
        editId,
        toProfessionalPayload(form, categories, true)
      );
      setEditId(null);
      setForm(emptyForm);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await removeProfessional(deleteConfirm);
      setDeleteConfirm(null);
      setDeleteError("");
    } catch (err) {
      setDeleteError(
        getErrorMessage(err, "No se pudo inactivar el profesional")
      );
    }
  };

  const viewed = professionals.find((p) => p.id === viewId);
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const { active: activePros, inactive: inactivePros } = useMemo(() => {
    const active: Professional[] = [];
    const inactive: Professional[] = [];
    for (const p of professionals) {
      (p.active ? active : inactive).push(p);
    }
    return { active, inactive };
  }, [professionals]);

  const renderCard = (p: Professional) => (
    <ProCard
      key={p.id}
      p={p}
      categoryMap={categoryMap}
      role={role}
      onView={setViewId}
      onEdit={startEdit}
      onDelete={setDeleteConfirm}
      onSchedule={openSchedule}
    />
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">Gestiona tus profesionales</p>
        </div>
        {canDo(role, "professionals_create") && (
          <Button
            onClick={() => {
              setShowCreate(true);
              setForm(emptyForm);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : loadError ? (
        <ErrorDeCarga
          error={loadError}
          recurso="los profesionales"
          onReintentar={() => void reload()}
        />
      ) : professionals.length === 0 ? (
        <p className="text-muted-foreground">
          No hay profesionales registrados
        </p>
      ) : (
        <>
          <ProfessionalGroup
            title="Activos"
            dotColor="bg-success"
            items={activePros}
          >
            {renderCard}
          </ProfessionalGroup>
          <ProfessionalGroup
            title="Inactivos"
            dotColor="bg-gray-400"
            items={inactivePros}
          >
            {renderCard}
          </ProfessionalGroup>
        </>
      )}

      <ProfessionalDetailDialog
        professional={viewed}
        onClose={() => setViewId(null)}
        onEdit={startEdit}
      />

      <ProfessionalFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        form={form}
        onChange={setForm}
        categories={categories}
        title="Nuevo profesional"
        submitLabel="Crear profesional"
      />

      <ProfessionalFormDialog
        open={!!editId}
        onClose={() => {
          setEditId(null);
          setForm(emptyForm);
        }}
        onSubmit={handleUpdate}
        form={form}
        onChange={setForm}
        categories={categories}
        title="Editar profesional"
        submitLabel="Guardar cambios"
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError("");
        }}
        onConfirm={handleDelete}
        title="Inactivar profesional"
        confirmLabel="Si, inactivar"
        variant="destructive"
        error={
          deleteError &&
          `${deleteError} Si tiene citas pendientes o confirmadas, debes cancelarlas o reasignarlas antes de inactivarlo.`
        }
      >
        Estas seguro de inactivar a{" "}
        <strong>
          {professionals.find((p) => p.id === deleteConfirm)?.name}
        </strong>
        ? Quedara marcado como inactivo; si tiene citas pendientes, la accion
        sera rechazada.
      </ConfirmDialog>

      <ScheduleDialog
        open={scheduleDialog}
        onClose={() => setScheduleDialog(false)}
        onSave={saveSchedule}
        professional={schedulePro}
        hours={scheduleHours}
        onChange={setScheduleHours}
        saving={savingSchedule}
        error={scheduleError}
      />
    </div>
  );
}
