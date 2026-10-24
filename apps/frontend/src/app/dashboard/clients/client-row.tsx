"use client";

import { memo } from "react";
import { Award, Edit, Eye, Mail, Merge, Phone, Trash2 } from "lucide-react";
import { AccionesDeFila } from "@/components/ui/acciones-de-fila";
import {
  CeldaDeTabla,
  CeldaPrincipal,
  FilaDeTabla,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatDate } from "@/lib/utils";
import type { Client } from "./schemas";

/** Campos por los que ordena el servidor. La lista viene paginada. */
export type CampoDeOrden = "name" | "createdAt";

export const COLUMNAS_DE_CLIENTES: ColumnaDeTabla<CampoDeOrden>[] = [
  { label: "Cliente", campo: "name" },
  { label: "Email", ocultaEnMovil: true },
  // En movil el telefono va bajo el nombre.
  { label: "Teléfono", ocultaEnMovil: true },
  { label: "Alta", campo: "createdAt", ocultaEnMovil: true },
  { label: "Puntos", alineacion: "right", ocultaEnMovil: true },
];

interface ClientRowProps {
  client: Client;
  puedeEditar: boolean;
  puedeFusionar: boolean;
  onVerFicha: (client: Client) => void;
  onEditar: (client: Client) => void;
  onFusionar: (client: Client) => void;
  onSuprimir: (client: Client) => void;
}

/** Fila de un cliente, con su contacto, sus puntos y las acciones de su ficha. */
export const ClientRow = memo(function ClientRow({
  client,
  puedeEditar,
  puedeFusionar,
  onVerFicha,
  onEditar,
  onFusionar,
  onSuprimir,
}: ClientRowProps) {
  // Una ficha anonimizada no se edita ni se fusiona.
  const editable = puedeEditar && !client.anonymizedAt;

  return (
    <FilaDeTabla
      acciones={
        <AccionesDeFila
          sobre={client.name}
          acciones={[
            {
              etiqueta: "Ver ficha",
              descripcion: `Ver la ficha de ${client.name}`,
              icono: Eye,
              alElegir: () => onVerFicha(client),
            },
            editable && {
              etiqueta: "Editar",
              descripcion: `Editar a ${client.name}`,
              icono: Edit,
              alElegir: () => onEditar(client),
            },
            editable &&
              puedeFusionar && {
                etiqueta: "Fusionar",
                descripcion: `Fusionar la ficha de ${client.name} con otra`,
                icono: Merge,
                alElegir: () => onFusionar(client),
              },
            editable && {
              etiqueta: "Suprimir datos",
              descripcion: `Suprimir los datos de ${client.name}`,
              icono: Trash2,
              tono: "destructivo",
              alElegir: () => onSuprimir(client),
            },
          ]}
        />
      }
    >
      <CeldaPrincipal
        inicial={client.name.charAt(0)}
        titulo={
          /* El nombre abre la ficha, tambien con teclado. */
          <button
            type="button"
            onClick={() => onVerFicha(client)}
            aria-label={`Ver la ficha de ${client.name}`}
            className="focus-visible:ring-ring hover:text-primary rounded-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            {client.name}
          </button>
        }
        subtitulo={
          client.phone ? (
            <span className="md:hidden">{client.phone}</span>
          ) : undefined
        }
      />
      <CeldaDeTabla apagada ocultaEnMovil>
        {client.email ? (
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.email}</span>
          </span>
        ) : (
          "—"
        )}
      </CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
        {client.phone ? (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {client.phone}
          </span>
        ) : (
          "—"
        )}
      </CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
        {client.createdAt ? formatDate(client.createdAt) : "—"}
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" ocultaEnMovil>
        {client.loyaltyPoints > 0 ? (
          <span className="text-warning inline-flex items-center gap-1">
            <Award className="h-4 w-4" />
            {client.loyaltyPoints}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
