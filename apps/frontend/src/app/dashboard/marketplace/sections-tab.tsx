"use client";
import { useId } from "react";
import { ChevronDown, ChevronUp, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import { SECTION_TYPES, type SectionItem } from "./schemas";

function SectionRow({
  section,
  label,
  onMove,
  onToggle,
  onRename,
}: {
  section: SectionItem;
  label: string;
  onMove: (direction: "up" | "down") => void;
  onToggle: (enabled: boolean) => void;
  onRename: (title: string) => void;
}) {
  const titleId = useId();

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => onMove("up")}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Subir ${label}`}
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => onMove("down")}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Bajar ${label}`}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <Switch
        checked={section.enabled}
        onCheckedChange={onToggle}
        aria-label={`Mostrar la seccion ${label}`}
      />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Input
        id={titleId}
        placeholder="Titulo personalizado (opcional)"
        value={section.customTitle || ""}
        onChange={(e) => onRename(e.target.value)}
        className="h-8 max-w-48 text-sm"
        aria-label={`Titulo personalizado de ${label}`}
      />
    </div>
  );
}

interface SectionsTabProps {
  sections: SectionItem[];
  onChange: (sections: SectionItem[]) => void;
  onMove: (type: string, direction: "up" | "down") => void;
  onSave: () => void;
  saving: boolean;
  role: Role | null;
}

/** Orden y visibilidad de las secciones del perfil publico. */
export function SectionsTab({
  sections,
  onChange,
  onMove,
  onSave,
  saving,
  role,
}: SectionsTabProps) {
  const patch = (type: string, changes: Partial<SectionItem>) =>
    onChange(sections.map((s) => (s.type === type ? { ...s, ...changes } : s)));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Secciones del perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...sections]
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <SectionRow
              key={section.type}
              section={section}
              label={
                SECTION_TYPES.find((s) => s.type === section.type)?.label ||
                section.type
              }
              onMove={(direction) => onMove(section.type, direction)}
              onToggle={(enabled) => patch(section.type, { enabled })}
              onRename={(customTitle) => patch(section.type, { customTitle })}
            />
          ))}
        {canDo(role, "marketplace_edit") && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar secciones
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
