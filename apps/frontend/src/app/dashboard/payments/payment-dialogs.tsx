"use client";

// Dialogos para registrar, editar y devolver un pago.
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { VALOR_DEL_PUNTO } from "@beautyspot/shared-constants";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import {
  devolucionCompleta,
  type CitaCobrable,
  type Client,
  type CreateForm,
  type DevolucionForm,
  type EditForm,
  type Payment,
} from "./schemas";
import { nombreDelMetodo } from "@/lib/metodos-de-pago";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Efectivo", icon: <Banknote className="h-5 w-5" /> },
  {
    value: "CARD",
    label: nombreDelMetodo("CARD"),
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
  /** Citas atendidas del cliente elegido que aún no se han cobrado. */
  citasPorCobrar: CitaCobrable[];
  saving: boolean;
}

/** Cómo se nombra una cita en el desplegable: cuándo fue y qué se hizo. */
function etiquetaDeCita(cita: CitaCobrable): string {
  const servicios = (cita.appointmentServices ?? [])
    .map((s) => s.serviceName)
    .filter(Boolean)
    .join(", ");
  const cuando = `${formatDate(cita.date)} ${formatTime(cita.startTime)}`;
  return `${cuando} · ${servicios || "Cita"} · ${formatCurrency(Number(cita.totalAmount))}`;
}

/** Alta de un cobro, con o sin cita detrás. */
export function CreatePaymentDialog({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  clients,
  citasPorCobrar,
  saving,
}: CreatePaymentDialogProps) {
  const set = (patch: Partial<CreateForm>) => onChange({ ...form, ...patch });

  /** Al elegir una cita, el importe sale de ella y deja de escribirse a mano. */
  const cobraUnaCita = form.appointmentId !== "";
  const elegirCita = (appointmentId: string) => {
    const cita = citasPorCobrar.find((c) => c.id === appointmentId);
    set({
      appointmentId,
      amount: cita ? String(Number(cita.totalAmount)) : "",
    });
  };

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
        {form.clientId !== "" && citasPorCobrar.length > 0 && (
          <Field
            label="Cita"
            hint="Cobrar la cita trae su importe y deja registrado qué se vendió"
          >
            <Select
              value={form.appointmentId}
              onChange={(e) => elegirCita(e.target.value)}
            >
              <option value="">Venta suelta, sin cita</option>
              {citasPorCobrar.map((c) => (
                <option key={c.id} value={c.id}>
                  {etiquetaDeCita(c)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label="Monto (COP)"
          hint={cobraUnaCita ? "El importe lo fija la cita" : undefined}
        >
          <Input
            type="number"
            /* Un cobro de cero no existe, salvo cuando los puntos cubren el
               resto: ahi el monto es lo que el cliente pone aparte. */
            min={puntosUsados > 0 ? 0 : 1}
            placeholder="25000"
            value={form.amount}
            onChange={(e) => set({ amount: e.target.value })}
            readOnly={cobraUnaCita}
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
          <SubmitButton
            label="Registrar pago"
            pendingLabel="Guardando..."
            pending={saving}
          />
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
            min={1}
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
        <Field
          label="Motivo de la corrección"
          hint="Queda anotado en el cobro, junto a quién lo corrigió"
        >
          <Input
            placeholder="Se tecleó 300.000 en vez de 30.000"
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value })}
            required
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <SubmitButton
            label="Guardar cambios"
            pendingLabel="Guardando..."
            pending={saving}
          />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  /** Cobro que se devuelve; de él salen el importe y el método. */
  payment: Payment | null;
  form: DevolucionForm;
  onChange: (form: DevolucionForm) => void;
  saving: boolean;
  /** Motivo por el que el servicio rechazó la devolución. */
  error?: string;
}

/**
 * Devolución de un cobro, total o parcial. Hasta ahora la única salida era
 * dejar el cobro malo y compensarlo con un movimiento de caja suelto, sin
 * trazabilidad y descuadrando los informes de ingresos.
 */
export function RefundDialog({
  open,
  onClose,
  onSubmit,
  payment,
  form,
  onChange,
  saving,
  error,
}: RefundDialogProps) {
  if (!payment) return null;

  const set = (patch: Partial<DevolucionForm>) =>
    onChange({ ...form, ...patch });
  const cobrado = payment.amount;

  return (
    <Dialog open={open} onClose={onClose} title="Devolver un cobro">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          Se cobraron <strong>{formatCurrency(cobrado)}</strong> en{" "}
          {nombreDelMetodo(payment.method).toLowerCase()} el{" "}
          {formatDate(payment.createdAt.slice(0, 10))}.
        </p>

        <div
          className="space-y-2"
          role="group"
          aria-labelledby="refund-alcance"
        >
          <p id="refund-alcance" className="text-sm font-medium">
            Cuánto se devuelve
          </p>
          <RadioGroup
            options={[
              { value: "total", label: `Todo (${formatCurrency(cobrado)})` },
              { value: "parcial", label: "Una parte" },
            ]}
            value={form.alcance}
            onChange={(alcance) => set({ alcance })}
            label="Cuánto se devuelve"
          />
        </div>

        {form.alcance === "parcial" && (
          <Field label="Importe a devolver (COP)">
            <Input
              type="number"
              min={1}
              max={cobrado}
              value={form.importe}
              onChange={(e) => set({ importe: e.target.value })}
              required
            />
          </Field>
        )}

        {payment.method === "CASH" && (
          // El efectivo sale del cajón: sin caja abierta el servicio lo
          // rechaza, y es mejor decirlo antes de intentarlo.
          <p className="text-muted-foreground bg-muted/50 rounded-lg p-3 text-sm">
            El efectivo se descuenta de la caja abierta. Si no hay ninguna,
            ábrela antes de devolver.
          </p>
        )}

        <Field
          label="Motivo"
          hint="Queda anotado en el cobro, junto a quién lo devolvió"
        >
          <Input
            placeholder="El tinte salió mal y se le devolvió el dinero"
            value={form.motivo}
            onChange={(e) => set({ motivo: e.target.value })}
            required
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <SubmitButton
            label="Devolver"
            pendingLabel="Devolviendo..."
            pending={saving}
            disabled={!devolucionCompleta(form, cobrado)}
          />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
