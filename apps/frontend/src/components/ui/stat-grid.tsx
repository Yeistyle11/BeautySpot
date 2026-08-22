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

interface StatGridProps {
  stats: Stat[];
  /** Mientras carga, el valor se sustituye por puntos suspensivos. */
  loading?: boolean;
}

/** Fila de indicadores del panel: una tarjeta por metrica, con su icono. */
export function StatGrid({ stats, loading }: StatGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{stat.title}</p>
                <p className="mt-1 text-2xl font-bold">
                  {loading ? "..." : stat.value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
