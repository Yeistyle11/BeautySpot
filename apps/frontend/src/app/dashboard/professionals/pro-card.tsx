"use client";

// Tarjeta de un profesional en la rejilla, con sus datos y acciones.
import { memo } from "react";
import Image from "next/image";
import { Star, Briefcase, Eye, Pencil, Trash2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { canDo } from "@/lib/permissions";
import { imageUnoptimized } from "@/lib/image";
import type { Role } from "@/lib/store";
import type { Category, Professional } from "./schemas";

interface ProCardProps {
  p: Professional;
  categoryMap: Map<string, Category>;
  role: Role | null;
  onView: (id: string) => void;
  onEdit: (p: Professional) => void;
  onDelete: (id: string) => void;
  onSchedule: (p: Professional) => void;
}

/**
 * Tarjeta de un profesional en la rejilla del equipo.
 *
 * Va memoizada y con `content-visibility:auto` porque la rejilla puede tener
 * decenas de tarjetas y todas se re-renderizaban al abrir cualquier modal.
 */
export const ProCard = memo(function ProCard({
  p,
  categoryMap,
  role,
  onView,
  onEdit,
  onDelete,
  onSchedule,
}: ProCardProps) {
  const categoryColor = p.categoryId
    ? categoryMap.get(p.categoryId)?.color
    : undefined;

  return (
    <Card
      className={`border-0 shadow-sm transition-shadow [contain-intrinsic-size:auto_260px] [content-visibility:auto] hover:shadow-md ${!p.active ? "opacity-60" : ""}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {p.photo ? (
            <Image
              src={p.photo}
              alt={p.name || ""}
              width={56}
              height={56}
              unoptimized={imageUnoptimized(p.photo)}
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {(p.name || "?").charAt(0)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name || "Sin nombre"}</p>
            {p.category && (
              <Badge
                variant="secondary"
                className="mt-0.5 text-xs"
                // El color lo define cada categoria en base de datos, asi que
                // no puede salir de las clases de Tailwind. El sufijo "20" es
                // el alfa en hexadecimal (~12%) para el fondo.
                style={
                  categoryColor
                    ? {
                        backgroundColor: `${categoryColor}20`,
                        color: categoryColor,
                      }
                    : undefined
                }
              >
                {p.category}
              </Badge>
            )}
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-muted-foreground text-sm">
                {Number(p.rating).toFixed(1)} ({p.totalReviews})
              </span>
            </div>
          </div>
        </div>

        {p.bio && (
          <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
            {p.bio}
          </p>
        )}

        {p.specialties?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.specialties.slice(0, 3).map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
            {p.specialties.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{p.specialties.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Briefcase className="h-3.5 w-3.5" /> {p.yearsExp} anos de experiencia
        </div>

        <div className="mt-4 flex gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => onView(p.id)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> Ver
          </Button>
          {canDo(role, "professionals_edit") && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => onEdit(p)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => onSchedule(p)}
              >
                <Clock className="mr-1 h-3.5 w-3.5" /> Horarios
              </Button>
            </>
          )}
          {canDo(role, "professionals_delete") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive h-8 px-2"
              onClick={() => onDelete(p.id)}
              aria-label={`Inactivar a ${p.name || "este profesional"}`}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
