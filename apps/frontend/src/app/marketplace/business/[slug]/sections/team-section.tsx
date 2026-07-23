"use client";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Star, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { imageUnoptimized } from "@/lib/image";
import type { Professional } from "../schemas";

export function TeamSection({
  title,
  professionals,
  slug,
}: {
  title: string;
  professionals: Professional[];
  slug: string;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Users className="text-primary h-5 w-5" />
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {professionals.map((p) => (
          <Card key={p.id} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {p.photo ? (
                  <Image
                    src={p.photo}
                    alt={p.name}
                    width={64}
                    height={64}
                    unoptimized={imageUnoptimized(p.photo)}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="bg-primary/10 text-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold">
                    {p.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.tagline && (
                    <p className="text-primary text-sm font-medium">
                      {p.tagline}
                    </p>
                  )}
                  {p.specialties && p.specialties.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.specialties.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-muted-foreground mt-2 flex items-center gap-3 text-sm">
                    {p.yearsExp > 0 && <span>{p.yearsExp} anos de exp.</span>}
                    {Number(p.rating) > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {Number(p.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {p.bio && (
                <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
                  {p.bio}
                </p>
              )}
              <Link
                href={`/marketplace/business/${slug}/book?professionalId=${p.id}`}
                className="mt-3 block"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <Calendar className="h-3 w-3" />
                  Agendar con {p.name.split(" ")[0]}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
