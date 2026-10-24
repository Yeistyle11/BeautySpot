"use client";

// Tabla de miembros del equipo, con ordenamiento, exportacion a CSV y acciones por fila.
import { useState, useMemo } from "react";
import { Pencil, Power, PowerOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AccionesDeFila } from "@/components/ui/acciones-de-fila";
import {
  CeldaDeTabla,
  CeldaPrincipal,
  FilaDeTabla,
  TablaDeRegistros,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { canDo } from "@/lib/permissions";
import { nombreDelRol } from "@/lib/auth";
import { downloadCsv } from "@/lib/export-csv";
import type { Role } from "@/lib/store";
import {
  ROLE_BADGE,
  type SortField,
  type SortDir,
  type StaffMember,
} from "./schemas";

// En movil el email y el rol van bajo el nombre.
const COLUMNAS: ColumnaDeTabla<SortField>[] = [
  { label: "Nombre", campo: "name" },
  { label: "Email", campo: "email", ocultaEnMovil: true },
  { label: "Teléfono", ocultaEnMovil: true },
  { label: "Rol", campo: "role", ocultaEnMovil: true },
];

/** Descarga el equipo como CSV. */
function exportMembers(members: StaffMember[], filename: string) {
  downloadCsv(
    filename,
    ["Nombre", "Email", "Teléfono", "Rol", "Estado", "Fecha registro"],
    members.map((s) => [
      s.name,
      s.email,
      s.phone,
      nombreDelRol(s.role),
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
  sortDir: SortDir;
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
  sortDir,
  onToggleSort,
  onEdit,
  onRequestToggle,
}: MemberTableProps) {
  const [pestana, setPestana] = useState<"activos" | "inactivos">("activos");

  // Activas e inactivas van en pestañas separadas: quien tiene acceso son las
  // de la primera.
  const activos = useMemo(() => members.filter((m) => m.active), [members]);
  const inactivos = useMemo(() => members.filter((m) => !m.active), [members]);
  const visibles = pestana === "activos" ? activos : inactivos;

  if (members.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
          {icon} {title} ({members.length})
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          // Se exporta la pestaña que se esta viendo, no el total.
          onClick={() =>
            exportMembers(
              visibles,
              `${title.toLowerCase().replace(/ /g, "_")}_${pestana}`
            )
          }
        >
          <Download className="h-3 w-3" /> Exportar CSV
        </Button>
      </div>

      <Tabs
        value={pestana}
        onValueChange={(v) => setPestana(v as "activos" | "inactivos")}
      >
        <TabsList className="mb-3">
          <TabsTrigger value="activos">Activos ({activos.length})</TabsTrigger>
          <TabsTrigger value="inactivos">
            Inactivos ({inactivos.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {visibles.length === 0 ? (
        <p className="text-muted-foreground border-muted rounded-lg border border-dashed py-8 text-center text-sm">
          {pestana === "activos"
            ? "Ninguna cuenta activa en este grupo."
            : "Ninguna cuenta desactivada en este grupo."}
        </p>
      ) : (
        <TablaDeRegistros
          titulo={title}
          columnas={COLUMNAS}
          orden={{ campo: sortField, direccion: sortDir }}
          onOrdenar={onToggleSort}
        >
          {visibles.map((s) => (
            <FilaDeTabla
              key={s.id}
              className={s.active ? undefined : "opacity-50"}
              acciones={
                <AccionesDeFila
                  sobre={`la cuenta de ${s.name}`}
                  acciones={[
                    canDo(role, "staff_edit") && {
                      etiqueta: "Editar cuenta",
                      descripcion: `Editar la cuenta de ${s.name}`,
                      icono: Pencil,
                      alElegir: () => onEdit(s),
                    },
                    canDo(role, "staff_deactivate") &&
                      s.role !== "OWNER" && {
                        etiqueta: s.active ? "Desactivar" : "Activar",
                        descripcion: `${s.active ? "Desactivar" : "Activar"} la cuenta de ${s.name}`,
                        icono: s.active ? PowerOff : Power,
                        tono: s.active ? "destructivo" : "exito",
                        alElegir: () => onRequestToggle(s.id),
                      },
                  ]}
                />
              }
            >
              <CeldaPrincipal
                inicial={s.name?.charAt(0) || "U"}
                titulo={s.name}
                subtitulo={
                  <span className="flex items-center gap-1.5 md:hidden">
                    <Badge
                      variant={ROLE_BADGE[s.role] ?? "muted"}
                      className="shrink-0"
                    >
                      {nombreDelRol(s.role)}
                    </Badge>
                    <span className="truncate">{s.email}</span>
                  </span>
                }
              />
              <CeldaDeTabla apagada ocultaEnMovil>
                <span className="block max-w-[200px] truncate">{s.email}</span>
              </CeldaDeTabla>
              <CeldaDeTabla apagada ocultaEnMovil>
                {s.phone || "—"}
              </CeldaDeTabla>
              <CeldaDeTabla ocultaEnMovil>
                <Badge variant={ROLE_BADGE[s.role] ?? "muted"}>
                  {nombreDelRol(s.role)}
                </Badge>
              </CeldaDeTabla>
            </FilaDeTabla>
          ))}
        </TablaDeRegistros>
      )}
    </div>
  );
}
