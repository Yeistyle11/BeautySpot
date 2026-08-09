"use client";

// Ficha del cliente: los campos que el negocio se haya definido en Ajustes.
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { CampoDeFicha, ServicioBreve } from "./schemas";

interface FichaSectionProps {
  campos: CampoDeFicha[];
  servicios: ServicioBreve[];
  valores: Record<string, unknown>;
  onSave: (ficha: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  puedeEditar: boolean;
}

/** Un control por campo, según el tipo que el negocio le haya dado. */
function ControlDelCampo({
  campo,
  valor,
  onChange,
  deshabilitado,
}: {
  campo: CampoDeFicha;
  valor: unknown;
  onChange: (valor: unknown) => void;
  deshabilitado: boolean;
}) {
  if (campo.tipo === "si_no") {
    return (
      <Switch
        checked={valor === true}
        onCheckedChange={onChange}
        disabled={deshabilitado}
        aria-label={campo.etiqueta}
      />
    );
  }

  if (campo.tipo === "opciones") {
    return (
      <select
        className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={deshabilitado}
        aria-label={campo.etiqueta}
      >
        <option value="">Sin responder</option>
        {(campo.opciones ?? []).map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    );
  }

  const tipoHtml =
    campo.tipo === "numero"
      ? "number"
      : campo.tipo === "fecha"
        ? "date"
        : "text";

  return (
    <Input
      type={tipoHtml}
      value={valor === undefined || valor === null ? "" : String(valor)}
      disabled={deshabilitado}
      aria-label={campo.etiqueta}
      onChange={(e) => {
        const texto = e.target.value;
        if (texto === "") return onChange(undefined);
        // El número viaja como número: el backend rechaza el texto "42".
        onChange(campo.tipo === "numero" ? Number(texto) : texto);
      }}
    />
  );
}

/**
 * Ficha del cliente. Los campos generales van primero y los atados a servicios
 * después, agrupados por el servicio al que pertenecen.
 */
export function FichaSection({
  campos,
  servicios,
  valores,
  onSave,
  saving,
  puedeEditar,
}: FichaSectionProps) {
  const [borrador, setBorrador] = useState<Record<string, unknown>>(valores);

  // El cliente seleccionado cambia sin desmontar el diálogo.
  useEffect(() => setBorrador(valores), [valores]);

  if (campos.length === 0) return null;

  const generales = campos.filter((c) => (c.serviceIds ?? []).length === 0);
  const porServicio = campos.filter((c) => (c.serviceIds ?? []).length > 0);

  const nombresDeServicio = (ids: string[]) =>
    ids
      .map((id) => servicios.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(", ");

  const pintar = (campo: CampoDeFicha) => (
    <Field
      key={campo.id}
      label={campo.etiqueta + (campo.obligatorio ? " *" : "")}
      hint={
        (campo.serviceIds ?? []).length > 0
          ? `Para: ${nombresDeServicio(campo.serviceIds ?? [])}`
          : undefined
      }
    >
      <ControlDelCampo
        campo={campo}
        valor={borrador[campo.id]}
        deshabilitado={!puedeEditar}
        onChange={(valor) =>
          setBorrador((actual) => {
            const siguiente = { ...actual };
            if (valor === undefined) delete siguiente[campo.id];
            else siguiente[campo.id] = valor;
            return siguiente;
          })
        }
      />
    </Field>
  );

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">Ficha</h4>
      <div className="space-y-3">
        {generales.map(pintar)}
        {porServicio.map(pintar)}
      </div>
      {puedeEditar && (
        <Button
          size="sm"
          className="mt-4 gap-2"
          onClick={() => onSave(borrador)}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar ficha
        </Button>
      )}
    </div>
  );
}
