"use client";

import { rutaDeAlta } from "@/lib/alta-por-url";
import { UserPlus } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { LONGITUD_MINIMA_CONTRASENA } from "@beautyspot/shared-constants";
import { emptyCreateForm, type Professional } from "./schemas";

type CreateForm = typeof emptyCreateForm;

interface CreateMemberDialogProps {
  open: boolean;
  onClose: () => void;
  form: CreateForm;
  onChange: (form: CreateForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** Profesionales sin cuenta asociada, unicos vinculables. */
  unlinkedPros: Professional[];
  /** Recarga el equipo tras dar de alta un profesional desde aqui. */
  onRecargarProfesionales?: () => Promise<unknown>;
  saving: boolean;
  error: string;
}

/** Alta de una cuenta de usuario, con vinculo opcional a un profesional. */
export function CreateMemberDialog({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  unlinkedPros,
  onRecargarProfesionales,
  saving,
  error,
}: CreateMemberDialogProps) {
  const set = (patch: Partial<CreateForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Crear cuenta de usuario"
      descripcion="Da acceso al panel con el rol que le corresponda."
      icono={UserPlus}
      wide
      pie={
        <>
          <BotonDeCancelar />
          <SubmitButton
            form="alta-de-usuario"
            label="Crear cuenta"
            pendingLabel="Creando..."
            pending={saving}
          />
        </>
      }
    >
      <form id="alta-de-usuario" onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm"
          >
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *">
            <Input
              placeholder="Juan Perez"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
          </Field>
          <Field label="Email *">
            <Input
              type="email"
              placeholder="juan@correo.com"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              required
            />
          </Field>
          <Field label="Contraseña *">
            <Input
              type="password"
              placeholder={`Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`}
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              required
              minLength={LONGITUD_MINIMA_CONTRASENA}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              placeholder="+57 300 123 4567"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="Rol *">
            <Select
              value={form.role}
              onChange={(e) =>
                // Cambiar de rol invalida el profesional elegido: solo tiene
                // sentido vincular cuando el rol es PROFESSIONAL.
                set({ role: e.target.value, professionalId: "" })
              }
            >
              <option value="PROFESSIONAL">Profesional</option>
              <option value="RECEPTIONIST">Recepcionista</option>
              <option value="ADMIN">Administrador</option>
              <option value="CLIENT">Cliente</option>
            </Select>
          </Field>
          {/* El propio selector da de alta un profesional. */}
          {form.role === "PROFESSIONAL" && (
            <Field label="Vincular a profesional">
              <SelectorDeEntidad
                opciones={unlinkedPros.map((p) => ({
                  id: p.id,
                  nombre: p.name || "Sin nombre",
                }))}
                value={form.professionalId}
                onChange={(id) => set({ professionalId: id })}
                etiquetaDeVacio="Sin vincular"
                placeholder="Buscar profesional..."
                etiquetaDeAlta="Crear profesional"
                rutaDeAlta={rutaDeAlta("/dashboard/professionals")}
                onRecargarOpciones={onRecargarProfesionales}
              />
            </Field>
          )}
        </div>
      </form>
    </Dialog>
  );
}
