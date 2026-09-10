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
  faltaPorRepartir,
  totalDelCobro,
  type CitaCobrable,
  type Client,
  type CreateForm,
  type DevolucionForm,
  type EditForm,
  type LineaDeCobro,
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
  /** Si quien cobra puede además conceder un descuento. */
  puedeDescontar: boolean;
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
  puedeDescontar,
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

  // El reparto es opcional: mientras no se abra, el cobro entero entra por el
  // metodo elegido arriba.
  const reparte = form.metodos.length > 0;
  const falta = faltaPorRepartir(form);
  const total = totalDelCobro(form);

  const abrirReparto = () =>
    set({
      metodos: [
        { method: form.method, amount: total > 0 ? String(total) : "" },
      ],
    });
  const cerrarReparto = () => set({ metodos: [] });
  const cambiarLinea = (indice: number, patch: Partial<LineaDeCobro>) =>
    set({
      metodos: form.metodos.map((linea, i) =>
        i === indice ? { ...linea, ...patch } : linea
      ),
    });
  const quitarLinea = (indice: number) =>
    set({ metodos: form.metodos.filter((_, i) => i !== indice) });
  const anadirLinea = () => {
    const usados = new Set(form.metodos.map((linea) => linea.method));
    const libre = PAYMENT_METHOD_OPTIONS.find(
      (opcion) => !usados.has(opcion.value)
    );
    if (!libre) return;
    set({
      metodos: [
        ...form.metodos,
        { method: libre.value, amount: falta > 0 ? String(falta) : "" },
      ],
    });
  };

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
        {puedeDescontar && (
          <Field
            label="Descuento (COP)"
            hint="Lo que rebaja el negocio de su margen. Queda escrito con su motivo."
          >
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={form.descuentoComercial}
              onChange={(e) => set({ descuentoComercial: e.target.value })}
            />
          </Field>
        )}
        {puedeDescontar && Number(form.descuentoComercial) > 0 && (
          <Field label="Motivo del descuento *">
            <Input
              placeholder="Promoción del martes"
              value={form.motivoDescuento}
              onChange={(e) => set({ motivoDescuento: e.target.value })}
              required
            />
          </Field>
        )}
        <Field
          label="Propina (COP)"
          hint="Se cobra encima del monto y va para el profesional: no cuenta como venta."
        >
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={form.propina}
            onChange={(e) => set({ propina: e.target.value })}
          />
        </Field>
        {!reparte && (
          <div
            className="space-y-2"
            role="group"
            aria-labelledby="create-method"
          >
            <p id="create-method" className="text-sm font-medium">
              Método de pago
            </p>
            <RadioGroup
              options={PAYMENT_METHOD_OPTIONS}
              value={form.method}
              onChange={(method) => set({ method })}
              label="Método de pago"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={abrirReparto}
            >
              Pagar con varios métodos
            </Button>
          </div>
        )}
        {reparte && (
          <div
            className="space-y-2"
            role="group"
            aria-labelledby="create-split"
          >
            <p id="create-split" className="text-sm font-medium">
              Reparto del cobro
            </p>
            {form.metodos.map((linea, indice) => (
              <div key={indice} className="flex gap-2">
                <Select
                  value={linea.method}
                  onChange={(e) =>
                    cambiarLinea(indice, { method: e.target.value })
                  }
                  aria-label="Método de esta parte"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  aria-label="Importe de esta parte"
                  value={linea.amount}
                  onChange={(e) =>
                    cambiarLinea(indice, { amount: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quitarLinea(indice)}
                  aria-label="Quitar esta parte"
                >
                  Quitar
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-3">
              {form.metodos.length < PAYMENT_METHOD_OPTIONS.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={anadirLinea}
                >
                  Añadir método
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cerrarReparto}
              >
                Cobrar con uno solo
              </Button>
            </div>
            {/* El servidor exige que el reparto cuadre con el cobro: la
                pantalla lo dice antes de intentarlo. */}
            <p className="text-muted-foreground text-sm" role="status">
              {falta === 0
                ? `Repartido ${formatCurrency(total)}`
                : falta > 0
                  ? `Falta repartir ${formatCurrency(falta)}`
                  : `Sobran ${formatCurrency(-falta)}`}
            </p>
          </div>
        )}
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
            disabled={reparte && falta !== 0}
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
 * Devolución de un cobro, total o parcial, con su traza. La alternativa sería
 * compensarlo con un movimiento de caja suelto, que descuadra los informes de
 * ingresos y no deja constancia de nada.
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
          {/* El instante entero, no sus diez primeros caracteres: recortar el
              ISO da el dia en UTC, y a las diez de la noche en Colombia ya es
              el siguiente. El listado formatea en hora local y las dos
              superficies se contradecian sobre el mismo cobro. */}
          {formatDate(payment.createdAt)}.
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
