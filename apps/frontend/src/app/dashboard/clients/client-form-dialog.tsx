"use client";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ClientForm {
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  /** Solo se piden al editar: en el alta no hay nada que anotar todavia. */
  notes?: string;
}

export const emptyClientForm: ClientForm = {
  name: "",
  email: "",
  phone: "",
  birthDate: "",
};

interface ClientFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: ClientForm;
  onChange: (form: ClientForm) => void;
  title: string;
  submitLabel: string;
  saving: boolean;
  /** Muestra el campo de notas, que solo tiene sentido sobre una ficha ya creada. */
  conNotas?: boolean;
}

/**
 * Formulario de alta y edicion de un cliente: los campos son los mismos en los
 * dos casos, solo cambian el titulo, la etiqueta del boton y las notas.
 */
export function ClientFormDialog({
  open,
  onClose,
  onSubmit,
  form,
  onChange,
  title,
  submitLabel,
  saving,
  conNotas,
}: ClientFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input
            placeholder="Maria Garcia"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <Input
              type="email"
              placeholder="maria@email.com"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              type="tel"
              inputMode="tel"
              placeholder="+57 300 1234567"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>
        <Field
          label="Fecha de nacimiento"
          hint="Con ella el cliente recibe una felicitación el día de su cumpleaños."
        >
          <Input
            type="date"
            value={form.birthDate}
            onChange={(e) => onChange({ ...form, birthDate: e.target.value })}
          />
        </Field>
        {conNotas && (
          <Field label="Notas">
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              rows={3}
            />
          </Field>
        )}
        <div className="flex gap-3 pt-2">
          <SubmitButton
            label={submitLabel}
            pendingLabel="Guardando..."
            pending={saving}
          />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
