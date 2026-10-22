"use client";

// Campos de un cobro: importe, descuento, propina, medios, puntos y notas.
import { useId } from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { VALOR_DEL_PUNTO } from "@beautyspot/shared-constants";
import { formatCurrency } from "@/lib/utils";
import { nombreDelMetodo } from "@/lib/metodos-de-pago";
import {
  faltaPorRepartir,
  importeACobrar,
  totalDelCobro,
  type CreateForm,
  type LineaDeCobro,
} from "./schemas";

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

interface CamposDelCobroProps {
  form: CreateForm;
  onChange: (form: CreateForm) => void;
  /** Si quien cobra puede además conceder un descuento. */
  puedeDescontar: boolean;
  /** Saldo de puntos del cliente; con cero no se ofrece el canje. */
  puntosDisponibles: number;
}

/** Lo que se cobra y cómo, compartido por el alta de cobro y el cierre de cita. */
export function CamposDelCobro({
  form,
  onChange,
  puedeDescontar,
  puntosDisponibles,
}: CamposDelCobroProps) {
  const id = useId();
  const set = (patch: Partial<CreateForm>) => onChange({ ...form, ...patch });

  const cobraUnaCita = form.appointmentId !== "";
  const puntosUsados = Number(form.puntosUsados) || 0;
  const paga = importeACobrar(form);
  const rebajaLaCita = cobraUnaCita && paga !== Number(form.amount);

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
    <>
      <Field
        label="Monto (COP)"
        hint={
          rebajaLaCita
            ? `Total de la cita. Con la rebaja, el cliente paga ${formatCurrency(paga)}`
            : cobraUnaCita
              ? "El importe lo fija la cita"
              : undefined
        }
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
          {/* El descuento no pasa del importe. */}
          <Input
            type="number"
            min={0}
            max={Number(form.amount) || undefined}
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
          aria-labelledby={`${id}-metodo`}
        >
          <p id={`${id}-metodo`} className="text-sm font-medium">
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
          aria-labelledby={`${id}-reparto`}
        >
          <p id={`${id}-reparto`} className="text-sm font-medium">
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
            puntosUsados === 0
              ? "Cada punto descuenta un peso del total."
              : cobraUnaCita
                ? `Descuenta ${formatCurrency(puntosUsados * VALOR_DEL_PUNTO)} del total de la cita.`
                : `Descuenta ${formatCurrency(puntosUsados * VALOR_DEL_PUNTO)}. El monto de arriba es lo que paga aparte.`
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
    </>
  );
}
