"use client";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import type { BusinessData } from "./schemas";

/** Campos de texto simples del negocio, en el orden en que se muestran. */
const TEXT_FIELDS: {
  key: keyof BusinessData;
  label: string;
  placeholder?: string;
}[] = [
  { key: "name", label: "Nombre" },
  { key: "phone", label: "Telefono" },
  { key: "email", label: "Email" },
  { key: "website", label: "Sitio web" },
];

const LOCATION_FIELDS: { key: keyof BusinessData; label: string }[] = [
  { key: "address", label: "Direccion" },
  { key: "city", label: "Ciudad" },
  { key: "state", label: "Departamento" },
  { key: "country", label: "Pais" },
];

const IMAGE_FIELDS: { key: keyof BusinessData; label: string }[] = [
  { key: "logo", label: "Logo (URL)" },
  { key: "coverImage", label: "Imagen portada (URL)" },
];

interface BusinessTabProps {
  form: Partial<BusinessData>;
  onChange: (form: Partial<BusinessData>) => void;
  onSave: () => void;
  saving: boolean;
  loading: boolean;
  role: Role | null;
}

/** Datos publicos del negocio: contacto, ubicacion e imagenes. */
export function BusinessTab({
  form,
  onChange,
  onSave,
  saving,
  loading,
  role,
}: BusinessTabProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="text-muted-foreground p-8 text-center">
          Cargando...
        </CardContent>
      </Card>
    );
  }

  const field = (
    key: keyof BusinessData,
    label: string,
    placeholder?: string
  ) => (
    <Field key={key} label={label}>
      <Input
        value={(form[key] as string) || ""}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
      />
    </Field>
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Informacion del negocio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => field(f.key, f.label))}
          <Field label="Descripcion" className="sm:col-span-2">
            <Textarea
              value={form.description || ""}
              onChange={(e) =>
                onChange({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </Field>
          {LOCATION_FIELDS.map((f) => field(f.key, f.label))}
          {IMAGE_FIELDS.map((f) => field(f.key, f.label, "https://..."))}
        </div>
        {canDo(role, "settings_edit") && (
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
