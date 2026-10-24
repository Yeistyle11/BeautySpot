"use client";

// Acciones de una fila de listado: botones de icono en escritorio y un menu
// «⋯» con texto en movil, donde cuatro iconos de 44 px no caben en la fila.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AccionDeFila {
  /** Lo que hace, en corto: el texto del menu y el `title` del icono. */
  etiqueta: string;
  /** Nombre accesible del icono de escritorio, con el registro al que afecta. */
  descripcion: string;
  icono: LucideIcon;
  alElegir: () => void;
  tono?: "destructivo" | "exito";
  deshabilitada?: boolean;
  /**
   * `false` deja el hueco vacio en escritorio, para que los iconos de todas
   * las filas caigan en la misma columna, y la saca del menu.
   */
  visible?: boolean;
  /**
   * Accion que en escritorio ya se ve como `principal`, con texto; aqui solo
   * se lista para que en movil entre en el menu.
   */
  soloEnMenu?: boolean;
}

const TONO_DEL_ICONO = {
  destructivo: "hover:text-destructive hover:bg-destructive/10",
  exito: "hover:text-success",
} as const;

/**
 * Las acciones de una fila. Con una sola, el icono se ve en todos los anchos;
 * con mas, por debajo de `md` se agrupan en un menu que dice cada una con
 * palabras, porque en tactil no hay `title` que explique un icono.
 */
export function AccionesDeFila({
  sobre,
  acciones,
  principal,
}: {
  /** Nombre del registro, para el nombre accesible del menu. */
  sobre: string;
  /** Las que no apliquen pueden pasarse como `false` y no ocupan sitio. */
  acciones: (AccionDeFila | false | null | undefined)[];
  /**
   * Boton con texto delante de los iconos. Si hay menu, en movil se oculta:
   * para que siga a mano, se repite en `acciones` con `soloEnMenu`.
   */
  principal?: React.ReactNode;
}) {
  const aplicables = acciones.filter((a): a is AccionDeFila => !!a);
  const visibles = aplicables.filter((a) => a.visible !== false);
  const conMenu = visibles.length > 1;

  return (
    <>
      {principal && (
        <div
          className={cn("items-center", conMenu ? "hidden md:flex" : "flex")}
        >
          {principal}
        </div>
      )}
      <div
        className={cn(
          "items-center gap-1",
          conMenu ? "hidden md:flex" : "flex"
        )}
      >
        {aplicables
          .filter((a) => !a.soloEnMenu)
          .map((accion) =>
            accion.visible === false ? (
              <span
                key={accion.etiqueta}
                className="hidden h-8 w-8 md:block [@media(pointer:coarse)]:w-11"
                aria-hidden
              />
            ) : (
              <Button
                key={accion.etiqueta}
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  accion.tono && TONO_DEL_ICONO[accion.tono]
                )}
                onClick={accion.alElegir}
                disabled={accion.deshabilitada}
                aria-label={accion.descripcion}
                title={accion.etiqueta}
              >
                <accion.icono className="h-4 w-4" />
              </Button>
            )
          )}
      </div>
      {conMenu && (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 md:hidden"
              aria-label={`Acciones de ${sobre}`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              collisionPadding={8}
              className="bg-popover text-popover-foreground animate-aparecer-lista shadow-raised z-50 min-w-48 rounded-lg border p-1"
            >
              {visibles.map((accion) => (
                <DropdownMenu.Item
                  key={accion.etiqueta}
                  onSelect={accion.alElegir}
                  disabled={accion.deshabilitada}
                  className={cn(
                    "focus:bg-muted flex min-h-11 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm outline-none data-[disabled]:opacity-50",
                    accion.tono === "destructivo" && "text-destructive"
                  )}
                >
                  <accion.icono className="h-4 w-4 shrink-0" aria-hidden />
                  {accion.etiqueta}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </>
  );
}
