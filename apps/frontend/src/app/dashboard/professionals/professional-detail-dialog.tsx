"use client";
import Image from "next/image";
import { Star, Briefcase, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { imageUnoptimized } from "@/lib/image";
import type { Professional } from "./schemas";

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

interface ProfessionalDetailDialogProps {
  professional: Professional | undefined;
  onClose: () => void;
  onEdit: (p: Professional) => void;
}

/** Ficha de solo lectura de un profesional, con acceso directo a editarlo. */
export function ProfessionalDetailDialog({
  professional,
  onClose,
  onEdit,
}: ProfessionalDetailDialogProps) {
  return (
    <Dialog
      open={!!professional}
      onClose={onClose}
      title="Detalle del profesional"
    >
      {professional && (
        <div>
          <div className="mb-5 flex items-start gap-5">
            {professional.photo ? (
              <Image
                src={professional.photo}
                alt={professional.name || ""}
                width={96}
                height={96}
                unoptimized={imageUnoptimized(professional.photo)}
                className="h-24 w-24 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="bg-primary/10 text-primary flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold">
                {(professional.name || "?").charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold">
                {professional.name || "Sin nombre"}
              </h3>
              {professional.category && (
                <Badge className="mt-1">{professional.category}</Badge>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-sm">
                  {Number(professional.rating).toFixed(1)} (
                  {professional.totalReviews} resenas)
                </span>
                <Badge variant={professional.active ? "default" : "secondary"}>
                  {professional.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          </div>

          {professional.bio && (
            <DetailBlock label="Biografia">
              <p className="text-sm">{professional.bio}</p>
            </DetailBlock>
          )}

          <DetailBlock label="Especialidades">
            <div className="flex flex-wrap gap-1">
              {professional.specialties?.length > 0 ? (
                professional.specialties.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">
                  Sin especialidades
                </span>
              )}
            </div>
          </DetailBlock>

          <DetailBlock label="Experiencia">
            <p className="flex items-center gap-2 text-sm">
              <Briefcase className="text-muted-foreground h-4 w-4" />{" "}
              {professional.yearsExp} anos de experiencia
            </p>
          </DetailBlock>

          <div className="flex gap-2 border-t pt-4">
            <Button onClick={() => onEdit(professional)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
