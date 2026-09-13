"use client";

import { CalendarOff } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { Textarea } from "@/components/ui/textarea";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import type { BlockedSlotForm } from "./schemas";

interface BlockedSlotFormDialogProps {
  open: boolean;
  onClose: () => void;
  form: BlockedSlotForm;
  onFormChange: (form: BlockedSlotForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  guardando: boolean;
  /** Equipo entre el que elegir. */
  profesionales?: { id: string; name: string }[];
  profesionalId?: string;
  onProfesionalChange?: (id: string) => void;
}

/** Alta de un bloqueo de agenda, con repetición opcional. */
export function BlockedSlotFormDialog({
  open,
  onClose,
  form,
  onFormChange,
  onSubmit,
  guardando,
  profesionales,
  profesionalId,
  onProfesionalChange,
}: BlockedSlotFormDialogProps) {
  const set = (cambios: Partial<BlockedSlotForm>) =>
    onFormChange({ ...form, ...cambios });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bloquear agenda"
      descripcion="Una franja en la que no se pueden reservar citas."
      icono={CalendarOff}
      pie={
        <>
          <BotonDeCancelar />
          <SubmitButton
            form="bloqueo"
            label="Bloquear"
            pendingLabel="Guardando..."
            pending={guardando}
          />
        </>
      }
    >
      <form id="bloqueo" onSubmit={onSubmit} className="space-y-4">
        {profesionales && onProfesionalChange && (
          <Field label="Profesional *">
            <SelectorDeEntidad
              opciones={profesionales.map((p) => ({
                id: p.id,
                nombre: p.name,
              }))}
              value={profesionalId ?? ""}
              onChange={onProfesionalChange}
              placeholder="Elige a quién se le bloquea"
              required
            />
          </Field>
        )}
        <Field label="Día *">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde *">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
              required
            />
          </Field>
          <Field label="Hasta *">
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field
          label="Repetir"
          hint="Se crea un bloqueo por cada día, hasta un máximo de 366."
        >
          <Select
            value={form.repeticion}
            onChange={(e) => set({ repeticion: e.target.value })}
          >
            <option value="">Solo este día</option>
            <option value="DIARIA">Todos los días</option>
            <option value="SEMANAL">Cada semana, el mismo día</option>
          </Select>
        </Field>
        {form.repeticion && (
          <Field label="Repetir hasta *">
            <Input
              type="date"
              min={form.date}
              value={form.repetirHasta}
              onChange={(e) => set({ repetirHasta: e.target.value })}
              required
            />
          </Field>
        )}
        <Field label="Motivo">
          <Textarea
            placeholder="Vacaciones, formación, cita médica..."
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value })}
            rows={2}
            maxLength={200}
          />
        </Field>
      </form>
    </Dialog>
  );
}
