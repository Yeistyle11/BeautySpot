"use client";
import { Clock } from "lucide-react";
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
  onContinue: () => void;
}

/** Paso 1: eleccion de servicios, con el total acumulado a la vista. */
export function SelectServicesStep({
  services,
  selected,
  onToggle,
  totalAmount,
  totalDuration,
  onContinue,
}: SelectServicesStepProps) {
  return (
    <Card className="border-0 shadow-sm">
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
                {formatCurrency(s.price)}
              </span>
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="bg-muted mt-4 rounded-lg p-3 text-sm">
            <p>
              Total:{" "}
              <span className="font-semibold">
                {formatCurrency(totalAmount)}
              </span>{" "}
              · Duracion: {totalDuration} min
            </p>
          </div>
        )}
        <Button
          className="mt-4 w-full"
          disabled={selected.length === 0}
          onClick={onContinue}
        >
          Continuar
        </Button>
      </CardContent>
    </Card>
  );
}
