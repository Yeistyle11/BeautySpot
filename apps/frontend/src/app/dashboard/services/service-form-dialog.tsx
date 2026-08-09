"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import type { ServiceForm, ServiceCategory } from "./schemas";

interface ServiceFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Alta o edicion: cambia el titulo, el boton y si se puede desactivar. */
  modo: "crear" | "editar";
  form: ServiceForm;
  onFormChange: (form: ServiceForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  guardando: boolean;
  categorias: ServiceCategory[];
}

/**
 * Formulario de servicio, compartido por el alta y la edicion. Los dos usan los
 * mismos cinco campos; solo la edicion permite activar o desactivar.
 */
export function ServiceFormDialog({
  open,
  onClose,
  modo,
  form,
  onFormChange,
  onSubmit,
  guardando,
  categorias,
}: ServiceFormDialogProps) {
  const set = (cambios: Partial<ServiceForm>) =>
    onFormChange({ ...form, ...cambios });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={modo === "crear" ? "Nuevo servicio" : "Editar servicio"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input
            placeholder="Corte clasico"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio (COP)">
            <Input
              type="number"
              placeholder="25000"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              required
            />
          </Field>
          <Field label="Duración (min)">
            <Input
              type="number"
              placeholder="30"
              value={form.duration}
              onChange={(e) => set({ duration: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="Categoría">
          <Select
            value={form.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
          >
            <option value="">Sin categoría</option>
            {categorias
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Descripción">
          <Textarea
            placeholder="Descripción del servicio"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
          />
        </Field>
        {modo === "editar" && (
          <div className="flex items-center gap-3">
            <Switch
              id="service-active"
              checked={form.active}
              onCheckedChange={(checked) => set({ active: checked })}
            />
            <Label htmlFor="service-active">
              {form.active ? "Servicio activo" : "Servicio inactivo"}
            </Label>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={guardando}>
            {guardando
              ? "Guardando..."
              : modo === "crear"
                ? "Crear servicio"
                : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
