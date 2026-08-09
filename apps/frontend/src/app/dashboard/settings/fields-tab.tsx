"use client";

// Pestana de fichas: campos que el negocio anade a la ficha de sus clientes.
import { useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import {
  TIPOS_DE_CAMPO,
  type CampoDeFicha,
  type ServicioBreve,
} from "./schemas";

/** Campo en construccion: lo que el formulario envia al crear. */
export interface NuevoCampo {
  etiqueta: string;
  tipo: CampoDeFicha["tipo"];
  opciones: string;
  obligatorio: boolean;
  serviceIds: string[];
}

export const campoVacio: NuevoCampo = {
  etiqueta: "",
  tipo: "texto",
  opciones: "",
  obligatorio: false,
  serviceIds: [],
};

interface FieldsTabProps {
  campos: CampoDeFicha[];
  servicios: ServicioBreve[];
  onCreate: (campo: NuevoCampo) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  saving: boolean;
  role: Role | null;
}

/** Nombre legible del tipo de un campo. */
function nombreDelTipo(tipo: CampoDeFicha["tipo"]): string {
  return TIPOS_DE_CAMPO.find((t) => t.value === tipo)?.label ?? tipo;
}

/**
 * Campos configurables de la ficha del cliente. Cada negocio define los suyos:
 * una barberia y un centro estetico no preguntan lo mismo.
 */
export function FieldsTab({
  campos,
  servicios,
  onCreate,
  onRemove,
  saving,
  role,
}: FieldsTabProps) {
  const [nuevo, setNuevo] = useState<NuevoCampo>(campoVacio);
  const puedeEditar = canDo(role, "business_edit");

  const handleCreate = async () => {
    if (!nuevo.etiqueta.trim()) return;
    await onCreate(nuevo);
    setNuevo(campoVacio);
  };

  const alternarServicio = (id: string) => {
    setNuevo((actual) => ({
      ...actual,
      serviceIds: actual.serviceIds.includes(id)
        ? actual.serviceIds.filter((s) => s !== id)
        : [...actual.serviceIds, id],
    }));
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Ficha del cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Lo que quieras saber de cada cliente además de sus datos de contacto.
          Un campo sin servicios se pregunta a todos; con servicios, solo cuenta
          para quien los recibe.
        </p>

        <div className="space-y-2">
          {campos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no has definido ningún campo.
            </p>
          ) : (
            campos.map((campo) => (
              <div
                key={campo.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {campo.etiqueta}
                    {campo.obligatorio && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">
                      {nombreDelTipo(campo.tipo)}
                    </Badge>
                    {(campo.serviceIds ?? []).map((id) => (
                      <Badge key={id} variant="outline">
                        {servicios.find((s) => s.id === id)?.name ?? "Servicio"}
                      </Badge>
                    ))}
                  </div>
                  {campo.tipo === "opciones" && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {(campo.opciones ?? []).join(" · ")}
                    </p>
                  )}
                </div>
                {puedeEditar && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Quitar ${campo.etiqueta}`}
                    onClick={() => onRemove(campo.id)}
                    className="text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {puedeEditar && (
          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Añadir un campo</p>

            <Field label="Etiqueta">
              <Input
                placeholder="¿Alergias conocidas?"
                value={nuevo.etiqueta}
                onChange={(e) =>
                  setNuevo({ ...nuevo, etiqueta: e.target.value })
                }
              />
            </Field>

            <Field label="Tipo">
              <select
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                value={nuevo.tipo}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    tipo: e.target.value as CampoDeFicha["tipo"],
                  })
                }
              >
                {TIPOS_DE_CAMPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            {nuevo.tipo === "opciones" && (
              <Field
                label="Opciones"
                hint="Sepáralas con comas: Grasa, Seca, Mixta"
              >
                <Input
                  placeholder="Grasa, Seca, Mixta"
                  value={nuevo.opciones}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, opciones: e.target.value })
                  }
                />
              </Field>
            )}

            {servicios.length > 0 && (
              <Field
                label="Solo para estos servicios"
                hint="Si no marcas ninguno, se pregunta a todos los clientes"
              >
                <div className="flex flex-wrap gap-2">
                  {servicios.map((servicio) => {
                    const marcado = nuevo.serviceIds.includes(servicio.id);
                    return (
                      <Button
                        key={servicio.id}
                        type="button"
                        size="sm"
                        variant={marcado ? "default" : "outline"}
                        onClick={() => alternarServicio(servicio.id)}
                        className="gap-1"
                      >
                        {servicio.name}
                        {marcado && <X className="h-3 w-3" />}
                      </Button>
                    );
                  })}
                </div>
              </Field>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={nuevo.obligatorio}
                onCheckedChange={(v) => setNuevo({ ...nuevo, obligatorio: v })}
                aria-label="Campo obligatorio"
              />
              <span className="text-sm">Obligatorio</span>
            </div>

            <Button
              onClick={handleCreate}
              disabled={saving || !nuevo.etiqueta.trim()}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Añadir campo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
