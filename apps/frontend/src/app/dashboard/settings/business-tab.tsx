"use client";

// Pestana de negocio: edicion de los datos y la informacion de contacto del negocio.
import { Loader2, Save } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CampoDeImagen } from "@/components/ui/campo-de-imagen";
import { canDo } from "@/lib/permissions";
import { useAuthStore } from "@/lib/store";
import type { BusinessData } from "./schemas";

/** Campos de texto simples del negocio, en el orden en que se muestran. */
const TEXT_FIELDS: { key: keyof BusinessData; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Email" },
  { key: "website", label: "Sitio web" },
];

const LOCATION_FIELDS: { key: keyof BusinessData; label: string }[] = [
  { key: "address", label: "Dirección" },
  { key: "city", label: "Ciudad" },
  { key: "state", label: "Departamento" },
  { key: "country", label: "País" },
];

interface BusinessTabProps {
  form: Partial<BusinessData>;
  onChange: (form: Partial<BusinessData>) => void;
  onSave: () => void;
  saving: boolean;
  loading: boolean;
}

/** Datos publicos del negocio: contacto, ubicacion e imagenes. */
export function BusinessTab({
  form,
  onChange,
  onSave,
  saving,
  loading,
}: BusinessTabProps) {
  const role = useAuthStore((s) => s.role);
  const puedeEditar = canDo(role, "business_edit");
  if (loading) {
    return (
      <Card className="shadow-flat border-0">
        <CardContent className="text-muted-foreground p-8 text-center">
          <LoadingState />
        </CardContent>
      </Card>
    );
  }

  const field = (key: keyof BusinessData, label: string) => (
    <Field key={key} label={label}>
      <Input
        value={(form[key] as string) || ""}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
      />
    </Field>
  );

  return (
    <Card className="shadow-flat border-0">
      <CardHeader>
        <CardTitle className="text-lg">Información del negocio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => field(f.key, f.label))}
          <Field label="Descripción" className="sm:col-span-2">
            <Textarea
              value={form.description || ""}
              onChange={(e) =>
                onChange({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </Field>
          {LOCATION_FIELDS.map((f) => field(f.key, f.label))}
          <CampoDeImagen
            etiqueta="Logo"
            proposito="logo"
            forma="cuadrada"
            valor={form.logo}
            alCambiar={(logo) => onChange({ ...form, logo })}
            ayuda="Cuadrado, de al menos 512 px. Se aplica al guardar los cambios."
            deshabilitado={!puedeEditar}
          />
          <CampoDeImagen
            etiqueta="Portada"
            proposito="portada"
            forma="panoramica"
            valor={form.coverImage}
            alCambiar={(coverImage) => onChange({ ...form, coverImage })}
            ayuda="Horizontal, de al menos 1600 px de ancho. Se aplica al guardar los cambios."
            deshabilitado={!puedeEditar}
          />
        </div>
        {puedeEditar && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
