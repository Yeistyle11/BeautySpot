"use client";
import Image from "next/image";
import { Scissors } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { imageUnoptimized } from "@/lib/image";
import type { Professional } from "../schemas";

interface SelectProfessionalStepProps {
  professionals: Professional[];
  selected: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

/** Paso 2: profesional concreto o "cualquiera disponible". */
export function SelectProfessionalStep({
  professionals,
  selected,
  onSelect,
  onBack,
  onContinue,
}: SelectProfessionalStepProps) {
  const optionClass = (isSelected: boolean) =>
    `flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
      isSelected
        ? "border-primary bg-primary/5"
        : "border-input hover:border-primary/50"
    }`;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Selecciona el profesional</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {professionals.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={selected === p.id}
              className={optionClass(selected === p.id)}
            >
              {p.photo ? (
                <Image
                  src={p.photo}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized={imageUnoptimized(p.photo)}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                  {(p.name || "?").charAt(0)}
                </div>
              )}
              <div>
                <p className="font-medium">{p.name || "Profesional"}</p>
                {p.specialties && p.specialties.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    {p.specialties.join(", ")}
                  </p>
                )}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSelect("any")}
            aria-pressed={selected === "any"}
            className={optionClass(selected === "any")}
          >
            <div className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Cualquier profesional</p>
              <p className="text-muted-foreground text-sm">
                Se asignara el primero disponible
              </p>
            </div>
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Atras
          </Button>
          <Button disabled={!selected} onClick={onContinue} className="flex-1">
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
