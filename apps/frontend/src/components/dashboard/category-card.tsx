"use client";
import type { ComponentType } from "react";
import { Edit, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CategoryEntity } from "./category-manager";

interface CategoryCardProps {
  category: CategoryEntity;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  defaultColor: string;
  canEdit: boolean;
  canDelete: boolean;
  showIconName?: boolean;
  onToggle: (category: CategoryEntity) => void;
  onEdit: (category: CategoryEntity) => void;
  onDelete: (id: string) => void;
}

/** Tarjeta de una categoria en la rejilla. */
export function CategoryCard({
  category,
  icon: Icon,
  defaultColor,
  canEdit,
  canDelete,
  showIconName,
  onToggle,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const color = category.color || defaultColor;

  return (
    <Card
      className={`border-0 shadow-sm transition-shadow hover:shadow-md ${!category.active ? "opacity-60" : ""}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* El color lo define cada categoria en base de datos, asi que va
                inline; el sufijo "20" es el alfa (~12%) del fondo. */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="font-semibold">{category.name}</p>
              <div className="mt-1 flex items-center gap-2">
                {category.color && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                <Badge
                  variant={category.active ? "success" : "secondary"}
                  className="text-xs"
                >
                  {category.active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggle(category)}
                  aria-label={`${category.active ? "Desactivar" : "Activar"} la categoría ${category.name}`}
                  title={category.active ? "Desactivar" : "Activar"}
                >
                  {category.active ? (
                    <ToggleRight className="text-success h-4 w-4" />
                  ) : (
                    <ToggleLeft className="text-muted-foreground h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(category)}
                  aria-label={`Editar la categoría ${category.name}`}
                >
                  <Edit className="text-muted-foreground h-4 w-4" />
                </Button>
              </>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(category.id)}
                aria-label={`Eliminar la categoría ${category.name}`}
              >
                <Trash2 className="text-muted-foreground h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {category.description && (
          <p className="text-muted-foreground mt-2 text-sm">
            {category.description}
          </p>
        )}
        {showIconName && category.icon && (
          <p className="text-muted-foreground/60 mt-1 text-xs">
            Icono: {category.icon}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
