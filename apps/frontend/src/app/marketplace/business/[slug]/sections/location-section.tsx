// Seccion de ubicacion del perfil publico, con enlace al mapa.
import { ExternalLink, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Sede tal como se enseña aquí; la del negocio entra con el mismo molde. */
export interface UbicacionEnPerfil {
  id: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
}

function enlaceDelMapa(partes: string[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    partes.join(", ")
  )}`;
}

/** Una dirección con su enlace al mapa; con nombre si es una sede entre varias. */
function Ubicacion({ sede }: { sede: UbicacionEnPerfil }) {
  const partes = [sede.address, sede.city, sede.state, sede.country].filter(
    Boolean
  ) as string[];

  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        <MapPin className="h-5 w-5" />
      </div>
      <div>
        {sede.name && <p className="font-medium">{sede.name}</p>}
        <p
          className={
            sede.name ? "text-muted-foreground text-sm" : "font-medium"
          }
        >
          {partes.join(", ")}
        </p>
        {sede.phone && (
          <p className="text-muted-foreground text-sm">{sede.phone}</p>
        )}
        <a
          href={enlaceDelMapa(partes)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mt-2 inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Ver en Google Maps
        </a>
      </div>
    </div>
  );
}

/**
 * Dónde está el negocio. Con varias sedes se listan todas con su nombre: la
 * dirección del negocio es la de una sola, y quien reserva en la otra llegaría
 * al sitio equivocado.
 */
export function LocationSection({
  title,
  address,
  city,
  state,
  country,
  sedes = [],
}: {
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  sedes?: UbicacionEnPerfil[];
}) {
  const variasSedes = sedes.length > 1;
  const ubicaciones: UbicacionEnPerfil[] = variasSedes
    ? sedes.map((s) => ({ ...s, state, country }))
    : [{ id: "negocio", address, city, state, country }];

  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <MapPin className="text-primary h-5 w-5" />
        {variasSedes ? `${title} · ${sedes.length} sedes` : title}
      </h2>
      <Card className="shadow-flat border-0">
        <CardContent className="space-y-5 p-5">
          {ubicaciones.map((sede) => (
            <Ubicacion key={sede.id} sede={sede} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
