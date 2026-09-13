import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface Stat {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Clase de color del icono. */
  color: string;
  /** Clase de fondo del circulo del icono. */
  bg: string;
}

/** Cuánto ocupa cada tarjeta; la compacta es para una fila secundaria. */
type Densidad = "comoda" | "compacta";

/** Medidas de cada densidad. */
const MEDIDAS: Record<
  Densidad,
  { padding: string; cifra: string; circulo: string; icono: string }
> = {
  comoda: {
    padding: "p-6",
    cifra: "text-2xl",
    circulo: "h-12 w-12",
    icono: "h-6 w-6",
  },
  compacta: {
    padding: "p-4",
    cifra: "text-xl",
    circulo: "h-8 w-8",
    icono: "h-4 w-4",
  },
};

interface StatGridProps {
  stats: Stat[];
  /** Mientras carga, el valor se sustituye por puntos suspensivos. */
  loading?: boolean;
  densidad?: Densidad;
}

/** Fila de indicadores del panel: una tarjeta por metrica, con su icono. */
export function StatGrid({
  stats,
  loading,
  densidad = "comoda",
}: StatGridProps) {
  const medida = MEDIDAS[densidad];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="shadow-flat border-0">
          <CardContent className={medida.padding}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{stat.title}</p>
                <p className={`mt-1 font-bold ${medida.cifra}`}>
                  {loading ? "..." : stat.value}
                </p>
              </div>
              <div
                className={`flex items-center justify-center rounded-xl ${medida.circulo} ${stat.bg}`}
              >
                <stat.icon className={`${medida.icono} ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
