"use client";

import { memo } from "react";
import { Award, Edit, Eye, Mail, Merge, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { label: "Teléfono" },
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
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onVerFicha(client)}
            aria-label={`Ver la ficha de ${client.name}`}
            title="Ver ficha"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {editable && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEditar(client)}
                aria-label={`Editar a ${client.name}`}
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </Button>
              {puedeFusionar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onFusionar(client)}
                  aria-label={`Fusionar la ficha de ${client.name} con otra`}
                  title="Fusionar"
                >
                  <Merge className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                onClick={() => onSuprimir(client)}
                aria-label={`Suprimir los datos de ${client.name}`}
                title="Suprimir datos"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </>
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
      <CeldaDeTabla apagada>
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
