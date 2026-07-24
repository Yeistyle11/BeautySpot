"use client";

// Formulario de alta/edicion de un profesional.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import type { Category, ProfessionalForm } from "./schemas";

interface ProfessionalFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: ProfessionalForm;
  onChange: (form: ProfessionalForm) => void;
  categories: Category[];
  title: string;
  submitLabel: string;
}

/**
 * Formulario de alta y edicion de un profesional. Es el mismo en los dos casos
 * (antes estaba duplicado campo por campo en dos modales distintos), asi que
 * solo cambian el titulo y la etiqueta del boton.
 */
export function ProfessionalFormDialog({
  open,
  onClose,
  onSubmit,
  form,
  onChange,
  categories,
  title,
  submitLabel,
}: ProfessionalFormDialogProps) {
  const set = (patch: Partial<ProfessionalForm>) =>
    onChange({ ...form, ...patch });

  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *">
            <Input
              placeholder="Carlos Professional"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
          </Field>
          <Field label="Categoría">
            <Select
              value={form.categoryId}
              onChange={(e) => set({ categoryId: e.target.value })}
            >
              <option value="">Sin categoría</option>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Especialidades" hint="Separadas por comas">
            <Input
              placeholder="cortes, barba, tintes"
              value={form.specialties}
              onChange={(e) => set({ specialties: e.target.value })}
            />
          </Field>
          <Field label="Experiencia (anos)">
            <Input
              type="number"
              min={0}
              value={form.yearsExp}
              onChange={(e) => set({ yearsExp: e.target.value })}
            />
          </Field>
          <Field label="URL foto de perfil" className="sm:col-span-2">
            <Input
              placeholder="https://..."
              value={form.photo}
              onChange={(e) => set({ photo: e.target.value })}
            />
          </Field>
          <Field label="Biografia" className="sm:col-span-2">
            <Input
              placeholder="Breve descripcion profesional..."
              value={form.bio}
              onChange={(e) => set({ bio: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit">{submitLabel}</Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
