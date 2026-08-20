"use client";

// Desempeño por profesional dentro del periodo.
import { UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-0 shadow-sm lg:col-span-2">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 font-medium">Profesional</th>
                  <th className="py-2 text-right font-medium">Citas</th>
                  <th className="py-2 text-right font-medium">Ingresos</th>
                  <th className="py-2 text-right font-medium">Valoración</th>
                  <th className="py-2 text-right font-medium">Días activos</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.professionalId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{p.nombre}</td>
                    <td className="py-2 text-right">{p.appointments}</td>
                    <td className="py-2 text-right font-semibold">
                      {formatCurrency(p.revenue)}
                    </td>
                    {/*
                      Sin valoraciones no es que valga cero: es que todavía no
                      la ha valorado nadie.
                    */}
                    <td className="py-2 text-right">
                      {p.avgRating > 0 ? p.avgRating.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 text-right">{p.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
