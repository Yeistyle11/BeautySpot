"use client";

// Pestana de fidelizacion: los escalones por los que pasa el cliente segun sus
// puntos acumulados.
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import { CLASE_DE_COLOR, NOMBRE_DE_COLOR, type Nivel } from "@/lib/niveles";
import {
  COLORES_DE_NIVEL,
  MAXIMO_NIVELES_FIDELIDAD,
  PROPORCION_PUNTOS_FIDELIDAD,
  VALOR_DEL_PUNTO,
} from "@beautyspot/shared-constants";

interface LoyaltyTabProps {
  niveles: Nivel[];
  onChange: (niveles: Nivel[]) => void;
  onSave: () => void;
  saving: boolean;
  role: Role | null;
}

/** Lo que hay que gastar para ganar un punto, en la moneda del negocio. */
const GASTO_POR_PUNTO = Math.round(1 / PROPORCION_PUNTOS_FIDELIDAD);

/** Escala de niveles del programa de fidelidad. */
export function LoyaltyTab({
  niveles,
  onChange,
  onSave,
  saving,
  role,
}: LoyaltyTabProps) {
  const puedeEditar = canDo(role, "settings_edit");

  const actualizar = (indice: number, cambios: Partial<Nivel>) =>
    onChange(niveles.map((n, i) => (i === indice ? { ...n, ...cambios } : n)));

  const anadir = () => {
    const ultimo = niveles[niveles.length - 1];
    onChange([
      ...niveles,
      {
        min: (ultimo?.min ?? 0) + 100,
        label: "",
        color: COLORES_DE_NIVEL[niveles.length % COLORES_DE_NIVEL.length],
      },
    ]);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Programa de fidelidad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Cada cita atendida acredita un punto por cada {GASTO_POR_PUNTO}{" "}
          unidades de la cuenta, y al cobrar cada punto descuenta{" "}
          {VALOR_DEL_PUNTO}. Los niveles solo cambian lo que el cliente ve en su
          perfil.
        </p>

        <div className="space-y-3">
          {niveles.map((nivel, indice) => (
            <div
              key={indice}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <span
                className={`h-6 w-6 shrink-0 rounded-full ${CLASE_DE_COLOR[nivel.color]}`}
                aria-hidden="true"
              />
              <Input
                value={nivel.label}
                onChange={(e) => actualizar(indice, { label: e.target.value })}
                placeholder="Nombre del nivel"
                maxLength={30}
                className="h-8 w-40 text-sm"
                aria-label={`Nombre del nivel ${indice + 1}`}
                disabled={!puedeEditar}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  // El primero es el suelo del programa: mover su umbral dejaría
                  // sin nivel a quien todavía no tiene puntos.
                  disabled={!puedeEditar || indice === 0}
                  value={nivel.min}
                  onChange={(e) =>
                    actualizar(indice, { min: Number(e.target.value) })
                  }
                  className="h-8 w-24 text-sm"
                  aria-label={`Puntos del nivel ${indice + 1}`}
                />
                <span className="text-muted-foreground text-sm">puntos</span>
              </div>
              <Select
                value={nivel.color}
                onChange={(e) =>
                  actualizar(indice, {
                    color: e.target.value as Nivel["color"],
                  })
                }
                className="h-8 w-32 text-sm"
                aria-label={`Color del nivel ${indice + 1}`}
                disabled={!puedeEditar}
              >
                {COLORES_DE_NIVEL.map((color) => (
                  <option key={color} value={color}>
                    {NOMBRE_DE_COLOR[color]}
                  </option>
                ))}
              </Select>
              {puedeEditar && indice > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange(niveles.filter((_, i) => i !== indice))
                  }
                  aria-label={`Quitar el nivel ${indice + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {puedeEditar && (
          <div className="flex gap-3">
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar niveles
            </Button>
            <Button
              variant="outline"
              onClick={anadir}
              disabled={niveles.length >= MAXIMO_NIVELES_FIDELIDAD}
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir nivel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
