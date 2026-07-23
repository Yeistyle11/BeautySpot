"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
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
  saving,
  error,
}: CreateMemberDialogProps) {
  const set = (patch: Partial<CreateForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog open={open} onClose={onClose} title="Crear cuenta de usuario" wide>
      <form onSubmit={onSubmit} className="space-y-4">
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
          <Field label="Contrasena *">
            <Input
              type="password"
              placeholder="Minimo 8 caracteres"
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              required
              minLength={8}
            />
          </Field>
          <Field label="Telefono">
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
          {form.role === "PROFESSIONAL" && unlinkedPros.length > 0 && (
            <Field label="Vincular a profesional">
              <Select
                value={form.professionalId}
                onChange={(e) => set({ professionalId: e.target.value })}
              >
                <option value="">Sin vincular</option>
                {unlinkedPros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "Sin nombre"}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creando..." : "Crear cuenta"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
