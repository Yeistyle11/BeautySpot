"use client";

// Paso de seleccion de servicios en el flujo de reserva.
import { conCantidad } from "@beautyspot/shared-utils";
import { Clock } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Service } from "../schemas";

interface SelectServicesStepProps {
  services: Service[];
  selected: string[];
  onToggle: (id: string) => void;
  totalAmount: number;
  totalDuration: number;
  /** A donde se sale del asistente: la ficha del negocio. */
  rutaDelNegocio: string;
  onContinue: () => void;
}

/** Paso 1: eleccion de servicios, con el total acumulado a la vista. */
export function SelectServicesStep({
  services,
  selected,
  onToggle,
  rutaDelNegocio,
  totalAmount,
  totalDuration,
  onContinue,
}: SelectServicesStepProps) {
  return (
    <Card className="shadow-flat border-0">
      <CardHeader>
        <CardTitle>Selecciona los servicios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              aria-pressed={selected.includes(s.id)}
              className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                selected.includes(s.id)
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/50"
              }`}
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Clock className="h-3 w-3" />
                  {s.duration} min
                </p>
              </div>
              <span className="text-primary font-semibold">
                {/* El precio de este servicio cambia segun quien lo atienda:
                    hasta elegir profesional, es un «desde» y no una promesa. */}
                {s.precioVariable ? "desde " : ""}
                {formatCurrency(s.price)}
              </span>
            </button>
          ))}
        </div>
        {/* Lo que se lleva, lo que dura y lo que cuesta. */}
        {selected.length > 0 && (
          <div className="bg-muted mt-4 rounded-lg p-3 text-sm">
            <p>
              {conCantidad(selected.length, "servicio", "servicios")} ·{" "}
              {totalDuration} min ·{" "}
              <span className="font-semibold">
                {formatCurrency(totalAmount)}
              </span>
            </p>
          </div>
        )}
        {/* El primer paso no retrocede, pero si sale del asistente. */}
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={rutaDelNegocio}>Cancelar</Link>
          </Button>
          <Button
            className="flex-1"
            disabled={selected.length === 0}
            onClick={onContinue}
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
