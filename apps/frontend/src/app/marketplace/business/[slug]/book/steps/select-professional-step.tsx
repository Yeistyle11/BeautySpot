"use client";

// Paso de seleccion de profesional en el flujo de reserva.
import Image from "next/image";
import { MapPin, Scissors } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { imageUnoptimized } from "@/lib/image";
import type { Professional, SedePublica } from "../schemas";

interface SelectProfessionalStepProps {
  professionals: Professional[];
  selected: string;
  onSelect: (id: string) => void;
  /** Sedes del negocio. Con una sola no se pregunta: no hay nada que elegir. */
  sedes: SedePublica[];
  sedeElegida: string;
  onSedeChange: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

/** Paso 2: sede —si hay varias— y profesional concreto o "cualquiera". */
export function SelectProfessionalStep({
  professionals,
  selected,
  onSelect,
  sedes,
  sedeElegida,
  onSedeChange,
  onBack,
  onContinue,
}: SelectProfessionalStepProps) {
  const variasSedes = sedes.length > 1;
  const faltaSede = variasSedes && !sedeElegida;
  const optionClass = (isSelected: boolean) =>
    `flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
      isSelected
        ? "border-primary bg-primary/5"
        : "border-input hover:border-primary/50"
    }`;

  return (
    <Card className="shadow-flat border-0">
      <CardHeader>
        <CardTitle>
          {variasSedes
            ? "Elige sede y profesional"
            : "Selecciona el profesional"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {variasSedes && (
          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-medium">
              ¿A qué sede vas?
            </legend>
            <div className="space-y-2">
              {sedes.map((sede) => (
                <button
                  key={sede.id}
                  type="button"
                  onClick={() => onSedeChange(sede.id)}
                  aria-pressed={sedeElegida === sede.id}
                  className={optionClass(sedeElegida === sede.id)}
                >
                  <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{sede.name}</p>
                    {sede.address && (
                      <p className="text-muted-foreground text-sm">
                        {[sede.address, sede.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {faltaSede ? (
          <p className="text-muted-foreground text-sm">
            Elige la sede para ver quién atiende allí.
          </p>
        ) : (
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
                  Se asignará el primero disponible
                </p>
              </div>
            </button>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Atrás
          </Button>
          <Button
            disabled={!selected || faltaSede}
            onClick={onContinue}
            className="flex-1"
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
