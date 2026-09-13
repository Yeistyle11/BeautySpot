"use client";

// Dialogo para editar un miembro: datos, rol, estado y vinculo con un profesional.
import { rutaDeAlta } from "@/lib/alta-por-url";
import { Link2 } from "lucide-react";
import { UserCog } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LONGITUD_MINIMA_CONTRASENA } from "@beautyspot/shared-constants";
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
  /** Recarga el equipo tras dar de alta un profesional desde aqui. */
  onRecargarProfesionales?: () => Promise<unknown>;
  saving: boolean;
  error: string;
}

/**
 * Edicion de una cuenta en un solo formulario: datos personales, contrasena,
 * estado y vinculo con el perfil profesional. Se guarda todo junto porque cada
 * seccion pega contra un endpoint distinto y separarlo pediria cuatro pasos.
 */
export function EditMemberDialog({
  member,
  onClose,
  form,
  onChange,
  onSubmit,
  linkedPro,
  unlinkedPros,
  onRecargarProfesionales,
  saving,
  error,
}: EditMemberDialogProps) {
  const set = (patch: Partial<EditForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title={member ? `Editar: ${member.name}` : "Editar cuenta"}
      icono={UserCog}
      wide
      pie={
        member && (
          <>
            <BotonDeCancelar />
            <SubmitButton
              form="cuenta-de-usuario"
              label="Guardar todos los cambios"
              pendingLabel="Guardando..."
              pending={saving}
            />
          </>
        )
      }
    >
      {member && (
        <form id="cuenta-de-usuario" onSubmit={onSubmit} className="space-y-6">
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
              <Field label="Teléfono" className="sm:col-span-2">
                <Input
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Cambiar contraseña">
            <p className="text-muted-foreground mb-3 text-xs">
              Deja vacio para mantener la contraseña actual.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nueva contraseña">
                <Input
                  type="password"
                  placeholder={`Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`}
                  value={form.newPassword}
                  onChange={(e) => set({ newPassword: e.target.value })}
                  minLength={LONGITUD_MINIMA_CONTRASENA}
                />
              </Field>
              <Field label="Confirmar contraseña">
                <Input
                  type="password"
                  placeholder="Repetir contraseña"
                  value={form.confirmPassword}
                  onChange={(e) => set({ confirmPassword: e.target.value })}
                  minLength={8}
                />
              </Field>
            </div>
          </Section>

          {/* El dueño del negocio no puede desactivarse: se quedaria sin acceso. */}
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
                    ? "El usuario puede iniciar sesión y usar la plataforma."
                    : "El usuario no podra iniciar sesión, pero su perfil profesional seguira activo en el equipo."}
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
                      className="border-input rounded-sm"
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
                    <SelectorDeEntidad
                      id="edit-link-professional"
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
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No hay profesionales disponibles para vincular.
                    </p>
                  )}
                </div>
              )}
            </Section>
          )}
        </form>
      )}
    </Dialog>
  );
}
