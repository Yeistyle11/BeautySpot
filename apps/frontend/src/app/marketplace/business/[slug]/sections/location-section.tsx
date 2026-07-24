"use client";

// Seccion de ubicacion del perfil publico, con enlace al mapa.
import { ExternalLink, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function LocationSection({
  title,
  address,
  city,
  state,
  country,
}: {
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}) {
  const parts = [address, city, state, country].filter(Boolean);
  const mapQuery = parts.join(", ");

  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <MapPin className="text-primary h-5 w-5" />
        {title}
      </h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{parts.join(", ")}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1 text-sm hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver en Google Maps
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
