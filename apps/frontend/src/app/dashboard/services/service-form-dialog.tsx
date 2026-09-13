"use client";

import { rutaDeAlta } from "@/lib/alta-por-url";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { AvisoDeConflicto } from "@/components/ui/aviso-de-conflicto";
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
  /** Recarga el catalogo de categorias tras crear una desde aqui. */
  onRecargarCategorias?: () => Promise<unknown>;
  /** Motivo por el que no se guardó: alguien cambió el servicio mientras tanto. */
  conflicto?: string;
  /** Trae el servicio guardado sin cerrar el formulario. */
  onRecargar?: () => void;
  recargando?: boolean;
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
  onRecargarCategorias,
  conflicto,
  onRecargar,
  recargando,
}: ServiceFormDialogProps) {
  const set = (cambios: Partial<ServiceForm>) =>
    onFormChange({ ...form, ...cambios });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={modo === "crear" ? "Nuevo servicio" : "Editar servicio"}
      icono={Scissors}
      pie={
        <>
          <BotonDeCancelar />
          <Button type="submit" form="servicio" disabled={guardando}>
            {guardando
              ? "Guardando..."
              : modo === "crear"
                ? "Crear servicio"
                : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form id="servicio" onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input
            maxLength={200}
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
              min={0}
              placeholder="25000"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              required
            />
          </Field>
          <Field label="Duración (min)">
            <Input
              type="number"
              min={5}
              max={480}
              step={5}
              placeholder="30"
              value={form.duration}
              onChange={(e) => set({ duration: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="Categoría">
          <SelectorDeEntidad
            opciones={categorias
              .filter((c) => c.active)
              .map((c) => ({ id: c.id, nombre: c.name }))}
            value={form.categoryId}
            onChange={(id) => set({ categoryId: id })}
            etiquetaDeVacio="Sin categoría"
            placeholder="Buscar categoría..."
            etiquetaDeAlta="Crear categoría"
            rutaDeAlta={rutaDeAlta("/dashboard/service-categories")}
            onRecargarOpciones={onRecargarCategorias}
          />
        </Field>
        <Field label="Descripción">
          <Textarea
            placeholder="Descripción del servicio"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
          />
        </Field>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Tiempo de procesado y limpieza
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-muted-foreground text-xs">
              Si durante parte del servicio el profesional queda libre —los
              minutos en que actúa un tinte—, indícalo aquí y la agenda podrá
              vender ese hueco.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="El hueco empieza en el minuto">
                <Input
                  type="number"
                  min={0}
                  placeholder="20"
                  value={form.procesadoDesde}
                  onChange={(e) => set({ procesadoDesde: e.target.value })}
                />
              </Field>
              <Field label="y dura (min)">
                <Input
                  type="number"
                  min={1}
                  placeholder="40"
                  value={form.procesadoMinutos}
                  onChange={(e) => set({ procesadoMinutos: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Limpieza después (min)"
              hint="El profesional sigue ocupado, pero la clienta ya se fue"
            >
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.bufferDespues}
                onChange={(e) => set({ bufferDespues: e.target.value })}
              />
            </Field>
          </div>
        </details>
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
        {conflicto && onRecargar && (
          <AvisoDeConflicto
            mensaje={conflicto}
            onRecargar={onRecargar}
            recargando={recargando}
          />
        )}
      </form>
    </Dialog>
  );
}
