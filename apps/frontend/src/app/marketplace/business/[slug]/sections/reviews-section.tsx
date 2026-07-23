"use client";
import Image from "next/image";
import { Heart, MessageSquare, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { imageUnoptimized } from "@/lib/image";
import type { RatingDistribution, Review } from "../schemas";

export function ReviewsSection({
  title,
  reviews,
  ratingDist,
  rating,
  totalReviews,
}: {
  title: string;
  reviews: Review[];
  ratingDist: RatingDistribution | null;
  rating: number;
  totalReviews: number;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <MessageSquare className="text-primary h-5 w-5" />
        {title}
      </h2>

      <div className="mb-6 flex flex-col gap-6 sm:flex-row">
        <div className="bg-muted/50 flex flex-col items-center justify-center rounded-xl px-8 py-6">
          <div className="text-5xl font-bold">{Number(rating).toFixed(1)}</div>
          <div className="mt-1 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-5 w-5 ${
                  s <= Math.round(rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalReviews} {totalReviews === 1 ? "resena" : "resenas"}
          </p>
        </div>

        {ratingDist && (
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingDist[
                star as keyof RatingDistribution
              ] as number;
              const pct =
                ratingDist.total > 0 ? (count / ratingDist.total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-sm">
                  <span className="w-8 text-right">{star}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            Aun no hay resenas
          </p>
        ) : (
          reviews.map((r) => (
            <Card key={r.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= r.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      {r.isVerified && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary text-xs"
                        >
                          Verificada
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                      {r.serviceName && <span>{r.serviceName}</span>}
                      {r.professionalName && (
                        <span>con {r.professionalName}</span>
                      )}
                      <span>
                        {new Date(r.createdAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  {r.helpfulCount > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Heart className="h-3 w-3" />
                      {r.helpfulCount}
                    </span>
                  )}
                </div>

                {r.comment && (
                  <p className="mt-3 text-sm leading-relaxed">{r.comment}</p>
                )}

                {r.photos && r.photos.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {r.photos.map((photo, i) => (
                      <Image
                        key={i}
                        src={photo}
                        alt=""
                        width={64}
                        height={64}
                        unoptimized={imageUnoptimized(photo)}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}

                {r.response && (
                  <div className="bg-muted/50 mt-3 rounded-lg p-3">
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Respuesta del negocio
                    </p>
                    <p className="text-sm">{r.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
