"use client";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { EditForm, Professional, StaffMember } from "./schemas";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface EditMemberDialogProps {
  member: StaffMember | null;
  onClose: () => void;
  form: EditForm;
  onChange: (form: EditForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** Profesional ya vinculado a esta cuenta, si lo hay. */
  linkedPro: Professional | undefined;
  unlinkedPros: Professional[];
  saving: boolean;
  error: string;
}

/**
 * Edicion de una cuenta en un solo formulario: datos personales, contrasena,
 * estado y vinculo con el perfil profesional. Se guarda todo junto porque cada
 * seccion pega contra un endpoint distinto y separarlo obligaria al usuario a
 * confirmar cuatro veces.
 */
export function EditMemberDialog({
  member,
  onClose,
  form,
  onChange,
  onSubmit,
  linkedPro,
  unlinkedPros,
  saving,
  error,
}: EditMemberDialogProps) {
  const set = (patch: Partial<EditForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title={member ? `Editar: ${member.name}` : "Editar cuenta"}
      wide
    >
      {member && (
        <form onSubmit={onSubmit} className="space-y-6">
          {error && (
            <p
              role="alert"
              className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm"
            >
              {error}
            </p>
          )}

          <Section title="Datos personales">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <Input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
              <Field label="Telefono" className="sm:col-span-2">
                <Input
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Cambiar contrasena">
            <p className="text-muted-foreground mb-3 text-xs">
              Deja vacio para mantener la contrasena actual.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nueva contrasena">
                <Input
                  type="password"
                  placeholder="Minimo 8 caracteres"
                  value={form.newPassword}
                  onChange={(e) => set({ newPassword: e.target.value })}
                  minLength={8}
                />
              </Field>
              <Field label="Confirmar contrasena">
                <Input
                  type="password"
                  placeholder="Repetir contrasena"
                  value={form.confirmPassword}
                  onChange={(e) => set({ confirmPassword: e.target.value })}
                  minLength={8}
                />
              </Field>
            </div>
          </Section>

          {/* El dueno del negocio no puede desactivarse: se quedaria sin acceso. */}
          {member.role !== "OWNER" && (
            <Section title="Estado de la cuenta">
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="member-active"
                    checked={form.active}
                    onCheckedChange={(checked) => set({ active: checked })}
                  />
                  <Label htmlFor="member-active" className="text-sm">
                    {form.active ? "Cuenta activa" : "Cuenta inactiva"}
                  </Label>
                </div>
                <p className="text-muted-foreground text-xs">
                  {form.active
                    ? "El usuario puede iniciar sesion y usar la plataforma."
                    : "El usuario no podra iniciar sesion, pero su perfil profesional seguira activo en el equipo."}
                </p>
              </div>
            </Section>
          )}

          {member.role === "PROFESSIONAL" && (
            <Section title="Perfil profesional">
              {linkedPro ? (
                <div className="border-success-soft bg-success-soft flex items-center gap-3 rounded-lg border p-3">
                  <Link2 className="text-success h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Vinculado a: {linkedPro.name || "Sin nombre"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Este usuario esta asociado al perfil profesional
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={form.unlinkProfessional}
                      onChange={(e) =>
                        set({
                          unlinkProfessional: e.target.checked,
                          professionalId: "",
                        })
                      }
                    />
                    <span className="text-destructive text-xs font-medium">
                      Desvincular
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="edit-link-professional">
                    Vincular a profesional
                  </Label>
                  {unlinkedPros.length > 0 ? (
                    <Select
                      id="edit-link-professional"
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
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No hay profesionales disponibles para vincular.
                    </p>
                  )}
                </div>
              )}
            </Section>
          )}

          <div className="flex gap-2 border-t pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar todos los cambios"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
