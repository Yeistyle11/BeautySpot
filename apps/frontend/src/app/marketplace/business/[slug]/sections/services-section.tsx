"use client";

// Seccion de servicios del perfil publico: que ofrece el negocio, a que precio
// y cuanto dura, con enlace directo a reservarlo.
import Link from "next/link";
import { Clock, Scissors } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ServicioPublico } from "../schemas";

export function ServicesSection({
  title,
  services,
  slug,
}: {
  title: string;
  services: ServicioPublico[];
  slug: string;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Scissors className="text-primary h-5 w-5" />
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <Card key={s.id} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  {s.category && (
                    <Badge variant="secondary" className="mt-1">
                      {s.category}
                    </Badge>
                  )}
                  {s.description && (
                    <p className="text-muted-foreground mt-2 text-sm">
                      {s.description}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-2 flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3" />
                    {s.duration} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(s.price)}</p>
                  <Link href={`/marketplace/business/${slug}/book`}>
                    <Button size="sm" variant="outline" className="mt-2">
                      Reservar
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
