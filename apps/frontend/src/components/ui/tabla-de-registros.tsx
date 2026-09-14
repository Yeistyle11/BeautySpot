"use client";

// Tabla de una coleccion del panel: cabecera ordenable, columnas que se ocultan
// en movil y acciones por fila.
import type { ComponentType, CSSProperties } from "react";

/** Icono de una fila. Admite el color propio que traen las categorias. */
export type IconoDeFila = ComponentType<{
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
}>;
import { ArrowUpDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type DireccionDeOrden = "asc" | "desc";

export interface ColumnaDeTabla<C extends string = string> {
  label: string;
  /** Campo por el que ordena; si falta, la columna solo se muestra. */
  campo?: C;
  /** Se oculta por debajo de `md`, para datos prescindibles en móvil. */
  ocultaEnMovil?: boolean;
  /** Alineación del contenido. Los números van a la derecha. */
  alineacion?: "left" | "right";
}

interface TablaProps<C extends string> {
  /** Se lee en el `caption`; no se pinta. */
  titulo: string;
  columnas: ColumnaDeTabla<C>[];
  /** Campo y sentido del orden actual. */
  orden?: { campo: C; direccion: DireccionDeOrden };
  onOrdenar?: (campo: C) => void;
  /** Etiqueta de la última columna; vacía si la tabla no tiene acciones. */
  conAcciones?: boolean;
  children: React.ReactNode;
}

/** Flecha de orden de una columna, resaltada si ordena por ella. */
function IconoDeOrden({ activo }: { activo: boolean }) {
  return (
    <ArrowUpDown
      className={cn(
        "ml-1 inline h-3 w-3",
        activo ? "text-primary" : "text-muted-foreground/40"
      )}
    />
  );
}

/** Tabla de una coleccion del panel, con su cabecera ordenable. */
export function TablaDeRegistros<C extends string>({
  titulo,
  columnas,
  orden,
  onOrdenar,
  conAcciones = true,
  children,
}: TablaProps<C>) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="bg-muted/50 border-b">
              {columnas.map((col) => {
                const ordenada = !!col.campo && orden?.campo === col.campo;
                return (
                  <th
                    key={col.label}
                    scope="col"
                    // La flecha solo la ve quien mira; esto lo anuncia.
                    aria-sort={
                      ordenada
                        ? orden!.direccion === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "px-4 py-3 font-medium",
                      col.alineacion === "right" ? "text-right" : "text-left",
                      col.ocultaEnMovil && "hidden md:table-cell"
                    )}
                  >
                    {col.campo && onOrdenar ? (
                      <button
                        type="button"
                        className={cn(
                          "hover:text-foreground focus-visible:ring-ring flex items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                          col.alineacion === "right" && "ml-auto"
                        )}
                        onClick={() => onOrdenar(col.campo!)}
                      >
                        {col.label} <IconoDeOrden activo={ordenada} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
              {conAcciones && (
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Una fila del listado, con sus acciones en la ultima columna. */
export function FilaDeTabla({
  acciones,
  children,
}: {
  /** Botones de icono; se alinean a la derecha en su propia columna. */
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <tr className="hover:bg-muted/30 border-b transition-colors last:border-0">
      {children}
      {acciones !== undefined && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">{acciones}</div>
        </td>
      )}
    </tr>
  );
}

/** Celda normal de la tabla, con su alineacion y su visibilidad en movil. */
export function CeldaDeTabla({
  alineacion,
  ocultaEnMovil,
  apagada,
  className,
  children,
}: {
  alineacion?: "left" | "right";
  ocultaEnMovil?: boolean;
  /** Texto secundario, en el gris de apoyo. */
  apagada?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        alineacion === "right" && "text-right tabular-nums",
        ocultaEnMovil && "hidden md:table-cell",
        apagada && "text-muted-foreground",
        className
      )}
    >
      {children}
    </td>
  );
}

/**
 * Primera celda: identifica el registro con su icono (o inicial) y su nombre,
 * con una segunda línea opcional.
 */
export function CeldaPrincipal({
  icono: Icono,
  inicial,
  foto,
  colorDelIcono,
  grande,
  titulo,
  subtitulo,
}: {
  icono?: IconoDeFila;
  /** Alternativa al icono: la inicial del nombre. */
  inicial?: string;
  /** Retrato de la persona, cuando lo hay. */
  foto?: string | null;
  colorDelIcono?: string;
  /** Avatar de 48 px, para el equipo. */
  grande?: boolean;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
}) {
  const medida = grande ? "h-12 w-12" : "h-8 w-8";
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        {/* El distintivo es opcional: sin icono ni inicial, la fila empieza
            por el nombre. */}
        {Icono && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              medida,
              !colorDelIcono && "bg-primary/10"
            )}
            style={
              colorDelIcono
                ? { backgroundColor: `${colorDelIcono}1A` }
                : undefined
            }
          >
            <Icono
              className={cn(
                grande ? "h-6 w-6" : "h-4 w-4",
                !colorDelIcono && "text-primary"
              )}
              style={colorDelIcono ? { color: colorDelIcono } : undefined}
              aria-hidden="true"
            />
          </div>
        )}
        {!Icono && (inicial || foto) && (
          <Avatar className={cn("shrink-0", medida)}>
            {foto && <AvatarImage src={foto} alt="" />}
            <AvatarFallback
              className={cn(
                "bg-primary/10 text-primary font-bold",
                grande ? "text-sm" : "text-xs"
              )}
            >
              {inicial}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0">
          <div className="max-w-[220px] truncate font-medium">{titulo}</div>
          {subtitulo && (
            <div className="text-muted-foreground max-w-[220px] truncate text-xs">
              {subtitulo}
            </div>
          )}
        </div>
      </div>
    </td>
  );
}
