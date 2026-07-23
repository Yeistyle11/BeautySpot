"use client";
import { useState, useMemo, useCallback } from "react";
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
import { ProCard } from "./pro-card";
import { ProfessionalFormDialog } from "./professional-form-dialog";
import { ProfessionalDetailDialog } from "./professional-detail-dialog";
import { ScheduleDialog } from "./schedule-dialog";
import {
  categorySchema,
  DAYS_MAP,
  emptyForm,
  professionalSchema,
  toProfessionalPayload,
  type AvailabilitySlot,
  type Category,
  type DayHours,
  type Professional,
} from "./schemas";

const PROFESSIONALS_KEY = "/core/professionals";
const CATEGORIES_KEY = "/core/categories";

/** Horario por defecto: laborables de 8 a 18, fin de semana cerrado. */
function defaultWeek(): Record<number, DayHours> {
  return Object.fromEntries(
    DAYS_MAP.map((d) => [
      d.value,
      {
        active: d.value >= 1 && d.value <= 5,
        startTime: "08:00",
        endTime: "18:00",
      },
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
  const { role } = useAuthStore();
  const {
    items: professionals,
    isLoading: loading,
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

  const openSchedule = useCallback((p: Professional) => {
    setSchedulePro(p);
    setScheduleDialog(true);
    api
      .get<AvailabilitySlot[]>(`/booking/professionals/${p.id}/availability`)
      .then((slots) => {
        // El backend solo devuelve los dias configurados: el resto se rellena
        // como inactivo para que la semana salga completa en el formulario.
        const week = Object.fromEntries(
          DAYS_MAP.map((d) => [
            d.value,
            { active: false, startTime: "08:00", endTime: "18:00" },
          ])
        ) as Record<number, DayHours>;
        slots.forEach((slot) => {
          week[slot.dayOfWeek] = {
            active: slot.active !== false,
            startTime: slot.startTime,
            endTime: slot.endTime,
          };
        });
        setScheduleHours(week);
      })
      .catch(() => {
        // Si el profesional aun no tiene horario, se propone el estandar en
        // vez de dejar el formulario vacio.
        setScheduleHours(defaultWeek());
      });
  }, []);

  const saveSchedule = async () => {
    if (!schedulePro) return;
    setSavingSchedule(true);
    try {
      await api.put(`/booking/professionals/${schedulePro.id}/availability`, {
        hours: Object.entries(scheduleHours).map(([day, h]) => ({
          dayOfWeek: Number(day),
          startTime: h.startTime,
          endTime: h.endTime,
          active: h.active,
        })),
      });
      setScheduleDialog(false);
    } catch (err) {
      logger.error(err);
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
      ) : professionals.length === 0 ? (
        <p className="text-muted-foreground">
          No hay profesionales registrados
        </p>
      ) : (
        <>
          <ProfessionalGroup
            title="Activos"
            dotColor="bg-emerald-500"
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
      />
    </div>
  );
}
