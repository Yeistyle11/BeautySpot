"use client";

// Dialogos para registrar, editar y devolver un pago.
import { rutaDeAlta } from "@/lib/alta-por-url";
import { Pencil, RotateCcw, Wallet } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import {
  cobroListo,
  devolucionCompleta,
  type CitaCobrable,
  type Client,
  type CreateForm,
  type DevolucionForm,
  type EditForm,
  type Payment,
} from "./schemas";
import { nombreDelMetodo } from "@/lib/metodos-de-pago";
import { CamposDelCobro, PAYMENT_METHOD_OPTIONS } from "./campos-del-cobro";

export { PAYMENT_METHOD_OPTIONS };

interface CreatePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  form: CreateForm;
  onChange: (form: CreateForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  clients: Client[];
  /** Recarga la cartera tras dar de alta un cliente desde aqui. */
  onRecargarClientes?: () => Promise<unknown>;
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
  onRecargarClientes,
  citasPorCobrar,
  saving,
  puedeDescontar,
}: CreatePaymentDialogProps) {
  const set = (patch: Partial<CreateForm>) => onChange({ ...form, ...patch });

  /** Al elegir una cita, el importe sale de ella y deja de escribirse a mano. */
  const elegirCita = (appointmentId: string) => {
    const cita = citasPorCobrar.find((c) => c.id === appointmentId);
    set({
      appointmentId,
      amount: cita ? String(Number(cita.totalAmount)) : "",
    });
  };

  const puntosDisponibles =
    clients.find((c) => c.id === form.clientId)?.loyaltyPoints ?? 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar pago"
      descripcion="Un cobro en mostrador o el de una cita pendiente."
      icono={Wallet}
      pie={
        <>
          <BotonDeCancelar />
          <SubmitButton
            form="cobro-nuevo"
            label="Registrar pago"
            pendingLabel="Guardando..."
            pending={saving}
            disabled={!cobroListo(form)}
          />
        </>
      }
    >
      <form id="cobro-nuevo" onSubmit={onSubmit} className="space-y-4">
        {/* El cliente es obligatorio en todo pago. */}
        <Field label="Cliente *">
          <SelectorDeEntidad
            opciones={clients.map((c) => ({ id: c.id, nombre: c.name }))}
            value={form.clientId}
            onChange={(id) => set({ clientId: id })}
            placeholder="Buscar cliente..."
            etiquetaDeAlta="Crear cliente"
            rutaDeAlta={rutaDeAlta("/dashboard/clients")}
            onRecargarOpciones={onRecargarClientes}
            required
          />
        </Field>
        {form.clientId !== "" && citasPorCobrar.length > 0 && (
          <Field
            label="Cita"
            hint="Cobrar la cita trae su importe y deja registrado qué se vendió"
          >
            <SelectorDeEntidad
              opciones={citasPorCobrar.map((c) => ({
                id: c.id,
                nombre: etiquetaDeCita(c),
              }))}
              value={form.appointmentId}
              onChange={elegirCita}
              etiquetaDeVacio="Venta suelta, sin cita"
              placeholder="Buscar la cita..."
            />
          </Field>
        )}
        <CamposDelCobro
          form={form}
          onChange={onChange}
          puedeDescontar={puedeDescontar}
          puntosDisponibles={puntosDisponibles}
        />
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar pago"
      icono={Pencil}
      pie={
        <>
          <BotonDeCancelar />
          <SubmitButton
            form="cobro-edicion"
            label="Guardar cambios"
            pendingLabel="Guardando..."
            pending={saving}
          />
        </>
      }
    >
      <form id="cobro-edicion" onSubmit={onSubmit} className="space-y-4">
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Devolver un cobro"
      icono={RotateCcw}
      pie={
        <>
          <BotonDeCancelar />
          <SubmitButton
            form="cobro-devolucion"
            label="Devolver"
            pendingLabel="Devolviendo..."
            pending={saving}
            disabled={!devolucionCompleta(form, cobrado)}
          />
        </>
      }
    >
      <form id="cobro-devolucion" onSubmit={onSubmit} className="space-y-4">
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
      </form>
    </Dialog>
  );
}
