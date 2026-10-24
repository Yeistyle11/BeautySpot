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
  { label: "Valoración", alineacion: "right" as const, ocultaEnMovil: true },
  { label: "Días activos", alineacion: "right" as const, ocultaEnMovil: true },
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

/**
 * Tabla de citas, ingresos y valoración de cada profesional en el periodo. El
 * ingreso de cada uno es el precio de lo que atendió, no lo cobrado, así que
 * la suma no tiene por qué dar el total del periodo; debajo se dice cuánto y
 * por qué.
 */
export function ProfessionalsTable({
  filas,
  ingresosDelPeriodo,
}: {
  filas: FilaDeProfesional[];
  /** Lo cobrado en el periodo, el mismo total que encabeza la página. */
  ingresosDelPeriodo?: number;
}) {
  const atendido = filas.reduce((suma, p) => suma + p.revenue, 0);
  const diferencia =
    ingresosDelPeriodo === undefined ? 0 : ingresosDelPeriodo - atendido;
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
                <CeldaDeTabla alineacion="right" ocultaEnMovil>
                  {p.avgRating > 0 ? p.avgRating.toFixed(2) : "—"}
                </CeldaDeTabla>
                <CeldaDeTabla alineacion="right" ocultaEnMovil>
                  {p.days}
                </CeldaDeTabla>
              </FilaDeTabla>
            ))}
          </TablaDeRegistros>
        )}
        {filas.length > 0 && Math.abs(diferencia) >= 1 && (
          <p className="text-muted-foreground mt-3 text-sm">
            El equipo suma {formatCurrency(atendido)} en citas atendidas y en el
            periodo se cobraron {formatCurrency(ingresosDelPeriodo ?? 0)}. La
            diferencia ({formatCurrency(Math.abs(diferencia))}) sale de cobros
            sin cita, descuentos, devoluciones y citas atendidas aún sin cobrar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
