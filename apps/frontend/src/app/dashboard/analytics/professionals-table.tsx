"use client";

// Desempeño por profesional dentro del periodo.
import { UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency } from "@/lib/utils";
import type { ReporteProfesionales } from "@/lib/schemas/kpis";

export interface FilaDeProfesional {
  professionalId: string;
  nombre: string;
  appointments: number;
  revenue: number;
  avgRating: number;
  days: number;
}

/**
 * Cruza el reporte con el equipo para poner nombre a cada fila; quien ya no
 * esta en el equipo sigue saliendo.
 */
const COLUMNAS_DE_RENDIMIENTO = [
  { label: "Profesional" },
  { label: "Citas", alineacion: "right" as const },
  { label: "Ingresos", alineacion: "right" as const },
  { label: "Valoración", alineacion: "right" as const },
  { label: "Días activos", alineacion: "right" as const },
];

/** Cruza el reporte con el equipo para dar a cada fila el nombre del profesional. */
export function filasDeProfesionales(
  reporte: ReporteProfesionales | undefined,
  equipo: { id: string; name: string }[] | undefined
): FilaDeProfesional[] {
  const nombres = new Map((equipo ?? []).map((p) => [p.id, p.name]));

  return (reporte?.professionals ?? [])
    .map((p) => ({
      ...p,
      nombre: nombres.get(p.professionalId) ?? "Profesional dado de baja",
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Tabla de citas, ingresos y valoración de cada profesional en el periodo. */
export function ProfessionalsTable({ filas }: { filas: FilaDeProfesional[] }) {
  return (
    <Card className="shadow-flat border-0 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserRound className="h-5 w-5" />
          Desempeño por profesional
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nadie atendió citas en el periodo.
          </p>
        ) : (
          <TablaDeRegistros
            titulo="Rendimiento por profesional"
            columnas={COLUMNAS_DE_RENDIMIENTO}
            conAcciones={false}
          >
            {filas.map((p) => (
              <FilaDeTabla key={p.professionalId}>
                <CeldaDeTabla className="font-medium">{p.nombre}</CeldaDeTabla>
                <CeldaDeTabla alineacion="right">{p.appointments}</CeldaDeTabla>
                <CeldaDeTabla alineacion="right" className="font-semibold">
                  {formatCurrency(p.revenue)}
                </CeldaDeTabla>
                {/* Sin valoraciones no hay nota, que no es lo mismo que un
                    cero. */}
                <CeldaDeTabla alineacion="right">
                  {p.avgRating > 0 ? p.avgRating.toFixed(2) : "—"}
                </CeldaDeTabla>
                <CeldaDeTabla alineacion="right">{p.days}</CeldaDeTabla>
              </FilaDeTabla>
            ))}
          </TablaDeRegistros>
        )}
      </CardContent>
    </Card>
  );
}
