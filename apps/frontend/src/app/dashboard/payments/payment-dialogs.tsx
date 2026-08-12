"use client";

// Dialogos para registrar y editar un pago (metodo, monto y notas).
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { VALOR_DEL_PUNTO } from "@beautyspot/shared-constants";
import { formatCurrency } from "@/lib/utils";
import type { Client, CreateForm, EditForm } from "./schemas";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Efectivo", icon: <Banknote className="h-5 w-5" /> },
  {
    value: "CARD",
    label: "Datáfono",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    value: "TRANSFER",
    label: "Transferencia",
    icon: <Smartphone className="h-5 w-5" />,
  },
];

interface CreatePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  form: CreateForm;
  onChange: (form: CreateForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  clients: Client[];
  saving: boolean;
}

/** Alta de un cobro suelto, sin cita asociada. */
export function CreatePaymentDialog({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  clients,
  saving,
}: CreatePaymentDialogProps) {
  const set = (patch: Partial<CreateForm>) => onChange({ ...form, ...patch });

  // El canje solo se ofrece si el cliente elegido tiene saldo: un campo a cero
  // en todos los cobros solo estorba.
  const puntosDisponibles =
    clients.find((c) => c.id === form.clientId)?.loyaltyPoints ?? 0;
  const puntosUsados = Number(form.puntosUsados) || 0;

  return (
    <Dialog open={open} onClose={onClose} title="Registrar pago">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* El servidor exige el cliente en todo pago, asi que el desplegable no
            ofrece "sin cliente": la opcion por defecto solo pide elegir uno. */}
        <Field label="Cliente *">
          <Select
            value={form.clientId}
            onChange={(e) => set({ clientId: e.target.value })}
            required
          >
            <option value="">Selecciona un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (COP)">
          <Input
            type="number"
            min={0}
            placeholder="25000"
            value={form.amount}
            onChange={(e) => set({ amount: e.target.value })}
            required
          />
        </Field>
        <div className="space-y-2" role="group" aria-labelledby="create-method">
          <p id="create-method" className="text-sm font-medium">
            Método de pago
          </p>
          <RadioGroup
            options={PAYMENT_METHOD_OPTIONS}
            value={form.method}
            onChange={(method) => set({ method })}
            label="Método de pago"
          />
        </div>
        {form.method === "TRANSFER" && (
          <Field label="Referencia">
            <Input
              placeholder="#123456789"
              value={form.reference}
              onChange={(e) => set({ reference: e.target.value })}
            />
          </Field>
        )}
        {puntosDisponibles > 0 && (
          <Field
            label={`Canjear puntos (tiene ${puntosDisponibles})`}
            hint={
              puntosUsados > 0
                ? `Descuenta ${formatCurrency(puntosUsados * VALOR_DEL_PUNTO)}. El monto de arriba es lo que paga aparte.`
                : "Cada punto descuenta un peso del total."
            }
          >
            <Input
              type="number"
              min={0}
              max={puntosDisponibles}
              placeholder="0"
              value={form.puntosUsados}
              onChange={(e) => set({ puntosUsados: e.target.value })}
            />
          </Field>
        )}
        <Field label="Notas">
          <Textarea
            placeholder="Notas sobre el pago..."
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Registrar pago"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface EditPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  form: EditForm;
  onChange: (form: EditForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
}

/** Correccion de un cobro ya registrado. */
export function EditPaymentDialog({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  saving,
}: EditPaymentDialogProps) {
  const set = (patch: Partial<EditForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog open={open} onClose={onClose} title="Editar pago">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Monto (COP)">
          <Input
            type="number"
            min={0}
            value={form.amount}
            onChange={(e) => set({ amount: e.target.value })}
            required
          />
        </Field>
        <div className="space-y-2" role="group" aria-labelledby="edit-method">
          <p id="edit-method" className="text-sm font-medium">
            Método de pago
          </p>
          <RadioGroup
            options={PAYMENT_METHOD_OPTIONS}
            value={form.method}
            onChange={(method) => set({ method })}
            label="Método de pago"
          />
        </div>
        {form.method === "TRANSFER" && (
          <Field label="Referencia">
            <Input
              placeholder="#123456789"
              value={form.reference}
              onChange={(e) => set({ reference: e.target.value })}
            />
          </Field>
        )}
        <Field label="Notas">
          <Textarea
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
