"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";

export interface CategoryForm {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: string;
  active: boolean;
}

interface CategoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: CategoryForm;
  onChange: (form: CategoryForm) => void;
  title: string;
  submitLabel: string;
  namePlaceholder: string;
  iconOptions: { value: string; label: string }[];
  colorPresets: string[];
  saving: boolean;
  /** El interruptor de activa/inactiva solo tiene sentido al editar. */
  showActiveToggle?: boolean;
  activeLabel?: string;
}

/**
 * Formulario de categoria, compartido por el alta y la edicion: antes eran dos
 * modales con los mismos campos duplicados campo a campo.
 */
export function CategoryFormDialog({
  open,
  onClose,
  onSubmit,
  form,
  onChange,
  title,
  submitLabel,
  namePlaceholder,
  iconOptions,
  colorPresets,
  saving,
  showActiveToggle = false,
  activeLabel = "Categoría activa",
}: CategoryFormDialogProps) {
  const set = (patch: Partial<CategoryForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre *">
          <Input
            placeholder={namePlaceholder}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </Field>

        <Field label="Icono">
          <Select
            value={form.icon}
            onChange={(e) => set({ icon: e.target.value })}
          >
            <option value="">Sin icono</option>
            {iconOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={(e) => set({ color: e.target.value })}
              className="border-input h-10 w-12 cursor-pointer rounded border p-0.5"
              aria-label="Color personalizado"
            />
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Colores sugeridos"
            >
              {colorPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ color: c })}
                  aria-label={`Usar el color ${c}`}
                  aria-pressed={form.color === c}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    form.color === c
                      ? "border-foreground scale-110"
                      : "hover:border-muted-foreground border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </Field>

        <Field label="Descripción">
          <Textarea
            placeholder="Descripción opcional de la categoría"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
          />
        </Field>

        <Field label="Orden">
          <Input
            type="number"
            min="0"
            max="999"
            value={form.sortOrder}
            onChange={(e) => set({ sortOrder: e.target.value })}
          />
        </Field>

        {showActiveToggle && (
          <div className="flex items-center gap-3">
            <Switch
              id="category-active"
              checked={form.active}
              onCheckedChange={(active) => set({ active })}
            />
            <Label htmlFor="category-active">{activeLabel}</Label>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
