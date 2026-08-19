"use client";

// Pestana de facturacion: los datos fiscales que salen impresos en la factura.
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import type { Facturacion } from "./schemas";

interface BillingTabProps {
  facturacion: Facturacion;
  onChange: (facturacion: Facturacion) => void;
  onSave: () => void;
  saving: boolean;
  role: Role | null;
}

/** Datos fiscales del negocio, con los que se emiten sus facturas. */
export function BillingTab({
  facturacion,
  onChange,
  onSave,
  saving,
  role,
}: BillingTabProps) {
  const puedeEditar = canDo(role, "business_edit");
  const set = (cambios: Partial<Facturacion>) =>
    onChange({ ...facturacion, ...cambios });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Datos de facturación</CardTitle>
        <p className="text-muted-foreground text-sm">
          Salen impresos en cada factura que emite el negocio.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social">
            <Input
              value={facturacion.razonSocial ?? ""}
              onChange={(e) => set({ razonSocial: e.target.value })}
              disabled={!puedeEditar}
              maxLength={200}
              placeholder="Barbería La Noche S.A.S."
            />
          </Field>
          <Field label="NIT">
            <Input
              value={facturacion.nit ?? ""}
              onChange={(e) => set({ nit: e.target.value })}
              disabled={!puedeEditar}
              maxLength={30}
              placeholder="900.123.456-7"
            />
          </Field>
        </div>
        <Field label="Dirección fiscal">
          <Input
            value={facturacion.direccionFiscal ?? ""}
            onChange={(e) => set({ direccionFiscal: e.target.value })}
            disabled={!puedeEditar}
            maxLength={300}
            placeholder="Calle 10 #5-40, Bogotá"
          />
        </Field>
        <Field
          label="Serie de numeración"
          hint="Prefijo de los números de factura: hasta 10 letras o números, sin espacios."
        >
          <Input
            value={facturacion.serie ?? ""}
            onChange={(e) => set({ serie: e.target.value })}
            disabled={!puedeEditar}
            maxLength={10}
            placeholder="INV"
          />
        </Field>

        {puedeEditar && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar datos de facturación
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
