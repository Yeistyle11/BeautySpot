"use client";

import { memo } from "react";
import { Edit, Power, PowerOff } from "lucide-react";
import { AccionesDeFila } from "@/components/ui/acciones-de-fila";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
  CeldaDeTabla,
  CeldaPrincipal,
  FilaDeTabla,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency } from "@/lib/utils";
import type { Service } from "./schemas";

/** Campos por los que se puede ordenar el catalogo. */
export type CampoDeOrden = "name" | "duration" | "price";

export const COLUMNAS_DE_SERVICIOS: ColumnaDeTabla<CampoDeOrden>[] = [
  { label: "Servicio", campo: "name" },
  { label: "Categoría", ocultaEnMovil: true },
  // En movil quedan solo el nombre y el precio.
  {
    label: "Duración",
    campo: "duration",
    alineacion: "right",
    ocultaEnMovil: true,
  },
  { label: "Precio", campo: "price", alineacion: "right" },
];

interface ServiceRowProps {
  service: Service;
  /** Si su categoria esta dada de alta en la taxonomia del negocio. */
  categoriaDelCatalogo: boolean;
  puedeEditar: boolean;
  puedeDesactivar: boolean;
  reactivando: boolean;
  onEditar: (service: Service) => void;
  onDesactivar: (service: Service) => void;
  onReactivar: (service: Service) => void;
}

/** Fila de un servicio del catalogo, con su categoria, duracion y precio. */
export const ServiceRow = memo(function ServiceRow({
  service,
  categoriaDelCatalogo,
  puedeEditar,
  puedeDesactivar,
  reactivando,
  onEditar,
  onDesactivar,
  onReactivar,
}: ServiceRowProps) {
  return (
    <FilaDeTabla
      acciones={
        <AccionesDeFila
          sobre={service.name}
          acciones={[
            puedeEditar && {
              etiqueta: "Editar servicio",
              descripcion: `Editar el servicio ${service.name}`,
              icono: Edit,
              alElegir: () => onEditar(service),
            },
            // Desactiva, no borra: al servicio lo referencian citas y cobros.
            puedeDesactivar &&
              (service.active
                ? {
                    etiqueta: "Desactivar servicio",
                    descripcion: `Desactivar el servicio ${service.name}`,
                    icono: PowerOff,
                    tono: "destructivo",
                    alElegir: () => onDesactivar(service),
                  }
                : {
                    etiqueta: "Activar servicio",
                    descripcion: `Activar el servicio ${service.name}`,
                    icono: Power,
                    tono: "exito",
                    alElegir: () => onReactivar(service),
                    deshabilitada: reactivando,
                  }),
          ]}
        />
      }
    >
      <CeldaPrincipal titulo={service.name} subtitulo={service.description} />
      <CeldaDeTabla ocultaEnMovil>
        <CategoryBadge
          nombre={service.category ?? ""}
          delCatalogo={categoriaDelCatalogo}
        />
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" apagada ocultaEnMovil>
        {service.duration} min
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" className="text-primary font-semibold">
        {formatCurrency(service.price)}
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
