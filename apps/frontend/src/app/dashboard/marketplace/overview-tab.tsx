"use client";
import { CheckCircle, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import type { GalleryImage, Profile } from "./schemas";

/** Casilla de la lista de completitud: verde cuando el bloque esta relleno. */
function CompletenessItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div
      className={`rounded p-2 ${done ? "bg-success-soft text-success-soft-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {done && <CheckCircle className="mr-1 inline h-3 w-3" />} {label}
    </div>
  );
}

interface OverviewTabProps {
  profile: Profile;
  gallery: GalleryImage[];
  role: Role | null;
  onTogglePublish: () => void;
}

/** Estado de publicacion y avance del perfil publico. */
export function OverviewTab({
  profile,
  gallery,
  role,
  onTogglePublish,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{profile.name}</h3>
              <p className="text-muted-foreground text-sm">/{profile.slug}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={profile.isPublished ? "success" : "secondary"}>
                {profile.isPublished ? "Publicado" : "No publicado"}
              </Badge>
              {canDo(role, "marketplace_edit") && (
                <Button
                  onClick={onTogglePublish}
                  variant={profile.isPublished ? "outline" : "default"}
                >
                  {profile.isPublished ? (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" /> Despublicar
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" /> Publicar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                Completitud del perfil
              </span>
              <span className="text-muted-foreground text-sm">
                {profile.profileCompleteness}%
              </span>
            </div>
            <Progress value={profile.profileCompleteness} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <CompletenessItem
                done={!!(profile.name && profile.description)}
                label="Datos basicos"
              />
              <CompletenessItem done={!!profile.storyText} label="Historia" />
              <CompletenessItem
                done={gallery.length >= 3}
                label="Galeria (3+)"
              />
              <CompletenessItem
                done={!!profile.socialLinks?.instagram}
                label="Redes sociales"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
