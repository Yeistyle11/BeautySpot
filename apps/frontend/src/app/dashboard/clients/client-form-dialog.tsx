"use client";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvisoDeConflicto } from "@/components/ui/aviso-de-conflicto";
// Solo el tipo: `schemas` importa de aqui `ClientForm`, y ambos lados se borran
// al compilar, asi que el ciclo no llega al paquete.
import type { Client } from "./schemas";

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
  /** Fichas que podrían ser la misma persona; solo al dar de alta. */
  posiblesDuplicados?: Client[];
  /** Abre una de esas fichas en vez de crear otra. */
  onAbrirFicha?: (cliente: Client) => void;
  /** Motivo por el que la ficha no se guardó: alguien la cambió mientras tanto. */
  conflicto?: string;
  /** Trae la ficha guardada sin cerrar el formulario. */
  onRecargar?: () => void;
  recargando?: boolean;
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
  posiblesDuplicados = [],
  onAbrirFicha,
  conflicto,
  onRecargar,
  recargando,
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
        {/* El contacto repetido lo rechaza el servidor; esto es para el otro
            duplicado, el que no comparte telefono ni correo. Avisar aqui evita
            la fusion despues, que ya no tiene marcha atras. */}
        {posiblesDuplicados.length > 0 && (
          <div
            role="status"
            className="border-warning/40 bg-warning-soft/40 space-y-2 rounded-lg border p-3"
          >
            <p className="text-sm font-medium">
              {posiblesDuplicados.length === 1
                ? "Ya hay una ficha parecida"
                : `Ya hay ${posiblesDuplicados.length} fichas parecidas`}
            </p>
            <ul className="space-y-1">
              {posiblesDuplicados.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {c.name}
                    {[c.phone, c.email].filter(Boolean).length > 0 && (
                      <span className="text-muted-foreground">
                        {" · "}
                        {[c.phone, c.email].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  {onAbrirFicha && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => onAbrirFicha(c)}
                    >
                      Abrir esta
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              Si es la misma persona, abre su ficha en vez de crear otra.
            </p>
          </div>
        )}

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
        {conflicto && onRecargar && (
          <AvisoDeConflicto
            mensaje={conflicto}
            onRecargar={onRecargar}
            recargando={recargando}
          />
        )}
        <div className="flex gap-3 pt-2">
          <SubmitButton
            label={submitLabel}
            pendingLabel="Guardando..."
            pending={saving}
            // El `required` del campo se conforma con espacios, y una ficha sin
            // nombre no se reconoce en el listado ni se encuentra buscando.
            disabled={!form.name.trim()}
          />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
