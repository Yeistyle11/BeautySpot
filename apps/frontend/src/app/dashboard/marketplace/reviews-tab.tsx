"use client";

// Pestana de resenas: listado de valoraciones y respuesta a los clientes.
import { MessageSquare, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import type { Review } from "./schemas";

/** Cinco estrellas, rellenas hasta la puntuacion dada. */
function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex" role="img" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`h-4 w-4 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

interface ReviewsTabProps {
  reviews: Review[];
  role: Role | null;
  drafts: Record<string, string>;
  onDraftChange: (drafts: Record<string, string>) => void;
  onRespond: (reviewId: string) => void;
}

/** Resenas recibidas y respuesta publica del negocio. */
export function ReviewsTab({
  reviews,
  role,
  drafts,
  onDraftChange,
  onRespond,
}: ReviewsTabProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Resenas ({reviews.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Star className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-2">Aun no tienes resenas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RatingStars rating={review.rating} />
                    <span className="text-muted-foreground text-sm">
                      {new Date(review.createdAt).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                  {review.serviceName && (
                    <Badge variant="secondary">{review.serviceName}</Badge>
                  )}
                </div>
                {review.comment && <p className="text-sm">{review.comment}</p>}

                {review.response ? (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Tu respuesta:
                    </p>
                    <p className="text-sm">{review.response}</p>
                  </div>
                ) : (
                  canDo(role, "reviews_respond") && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Responder a esta resena..."
                        value={drafts[review.id] || ""}
                        onChange={(e) =>
                          onDraftChange({
                            ...drafts,
                            [review.id]: e.target.value,
                          })
                        }
                        rows={2}
                        aria-label="Respuesta a la resena"
                      />
                      <Button
                        size="sm"
                        onClick={() => onRespond(review.id)}
                        disabled={!drafts[review.id]?.trim()}
                      >
                        <MessageSquare className="mr-2 h-3 w-3" /> Responder
                      </Button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
