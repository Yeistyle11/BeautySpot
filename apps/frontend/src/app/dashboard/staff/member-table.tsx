"use client";

// Tabla de miembros del equipo, con ordenamiento, exportacion a CSV y acciones por fila.
import { Pencil, Trash2, Download, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { canDo } from "@/lib/permissions";
import { downloadCsv } from "@/lib/export-csv";
import type { Role } from "@/lib/store";
import {
  ROLE_COLORS,
  ROLE_LABELS,
  type SortField,
  type StaffMember,
} from "./schemas";

function SortIcon({
  field,
  sortField,
}: {
  field: SortField;
  sortField: SortField;
}) {
  return (
    <ArrowUpDown
      className={`ml-1 inline h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`}
    />
  );
}

// Orden de columnas de la tabla. `sortable: false` para las que solo se
// muestran; `hiddenOnMobile` para las que se ocultan por debajo de md.
const COLUMNS: {
  label: string;
  field?: SortField;
  hiddenOnMobile?: boolean;
}[] = [
  { label: "Nombre", field: "name" },
  { label: "Email", field: "email" },
  { label: "Telefono", hiddenOnMobile: true },
  { label: "Rol", field: "role" },
  { label: "Estado", field: "active" },
];

function exportMembers(members: StaffMember[], filename: string) {
  downloadCsv(
    filename,
    ["Nombre", "Email", "Telefono", "Rol", "Estado", "Fecha registro"],
    members.map((s) => [
      s.name,
      s.email,
      s.phone,
      ROLE_LABELS[s.role] || s.role,
      s.active ? "Activo" : "Inactivo",
      s.joinedAt ? new Date(s.joinedAt).toLocaleDateString("es-CO") : "",
    ])
  );
}

interface MemberTableProps {
  members: StaffMember[];
  title: string;
  icon: React.ReactNode;
  dotColor: string;
  role: Role | null;
  sortField: SortField;
  onToggleSort: (field: SortField) => void;
  onEdit: (member: StaffMember) => void;
  onRequestToggle: (id: string) => void;
}

/** Tabla ordenable de cuentas, reutilizada para el equipo y para los clientes. */
export function MemberTable({
  members,
  title,
  icon,
  dotColor,
  role,
  sortField,
  onToggleSort,
  onEdit,
  onRequestToggle,
}: MemberTableProps) {
  if (members.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
          {icon} {title} ({members.length})
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() =>
            exportMembers(members, title.toLowerCase().replace(/ /g, "_"))
          }
        >
          <Download className="h-3 w-3" /> Exportar CSV
        </Button>
      </div>
      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="bg-muted/50 border-b">
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    scope="col"
                    className={`px-4 py-3 text-left font-medium ${col.hiddenOnMobile ? "hidden md:table-cell" : ""}`}
                  >
                    {col.field ? (
                      <button
                        className="hover:text-foreground flex items-center transition-colors"
                        onClick={() => onToggleSort(col.field!)}
                      >
                        {col.label}{" "}
                        <SortIcon field={col.field} sortField={sortField} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-muted/30 border-b transition-colors last:border-0 ${!s.active ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {s.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[180px] truncate font-medium">
                        {s.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted-foreground max-w-[200px] truncate px-4 py-3">
                    {s.email}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                    {s.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[s.role] || "bg-muted text-muted-foreground"}`}
                    >
                      {ROLE_LABELS[s.role] || s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={s.active ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {s.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canDo(role, "staff_edit") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => onEdit(s)}
                          aria-label={`Editar la cuenta de ${s.name}`}
                          title="Editar cuenta"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {canDo(role, "staff_deactivate") &&
                        s.role !== "OWNER" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                            onClick={() => onRequestToggle(s.id)}
                            aria-label={`${s.active ? "Desactivar" : "Activar"} la cuenta de ${s.name}`}
                            title={s.active ? "Desactivar" : "Activar"}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
