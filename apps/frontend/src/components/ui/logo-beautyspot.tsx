import { cn } from "@/lib/utils";
import { IsotipoBeautySpot } from "@/components/ui/isotipo-beautyspot";

/** Medidas del lockup: el isotipo y el logotipo crecen juntos. */
const TAMANOS = {
  sm: { isotipo: "h-8 w-8", texto: "text-base", hueco: "gap-2" },
  md: { isotipo: "h-9 w-9", texto: "text-lg", hueco: "gap-2.5" },
  lg: { isotipo: "h-12 w-12", texto: "text-2xl", hueco: "gap-3" },
} as const;

/**
 * Cómo se tiñe la palabra, por mitades.
 *
 * `marca` es la versión del pack: las dos en violeta —violeta claro sobre
 * oscuro, que es lo que hace `--marca`—. Va donde el logo es el protagonista y
 * tiene aire alrededor.
 *
 * `bitono` deja «Beauty» en la tinta del texto y tiñe solo «Spot». Es la de la
 * interfaz, y hace tres cosas a la vez: el violeta sigue siendo un acento en
 * vez de inundar una barra donde ya lo gastan la página activa y los botones;
 * el color cae en la misma mitad que el peso, que es la que nombra al lunar del
 * isotipo; y repite el titular del escaparate, que ya escribe la marca así.
 */
const TONOS = {
  marca: {
    beauty: "text-[hsl(var(--marca))]",
    spot: "text-[hsl(var(--marca))]",
  },
  bitono: { beauty: "text-foreground", spot: "text-[hsl(var(--marca))]" },
} as const;

/**
 * El logotipo: la palabra tal como está dibujada en la marca. «Beauty» en
 * regular y «Spot» en negrita, con el tracking cerrado del original, sobre
 * Archivo y no sobre la tipografía de la interfaz.
 *
 * Se reproduce con texto en vez de servir el PNG del pack por tres razones: el
 * PNG violeta viene recortado por la derecha, no hay versión transparente para
 * fondo oscuro —la oscura es una tarjeta con su propio fondo—, y como texto el
 * lector de pantalla lee la marca y no un `alt`.
 */
export function LogotipoBeautySpot({
  tono = "marca",
  className,
}: {
  tono?: keyof typeof TONOS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-logotipo whitespace-nowrap tracking-[-0.035em]",
        className
      )}
    >
      <span className={cn("font-normal", TONOS[tono].beauty)}>Beauty</span>
      <span className={cn("font-bold", TONOS[tono].spot)}>Spot</span>
    </span>
  );
}

/**
 * El lockup completo: isotipo y logotipo, con una bajada opcional debajo.
 *
 * `comoTitulo` saca el logotipo en un `h1`. Lo piden las pantallas de acceso,
 * donde la marca es el encabezado de la página; en el panel y en el escaparate
 * el título es otro y el logo solo acompaña.
 */
export function LogoBeautySpot({
  tamano = "md",
  tono = "marca",
  bajada,
  comoTitulo = false,
  className,
}: {
  tamano?: keyof typeof TAMANOS;
  tono?: keyof typeof TONOS;
  bajada?: string;
  comoTitulo?: boolean;
  className?: string;
}) {
  const medida = TAMANOS[tamano];
  const Palabra = comoTitulo ? "h1" : "span";
  return (
    <span className={cn("flex items-center", medida.hueco, className)}>
      <IsotipoBeautySpot className={cn(medida.isotipo, "shrink-0")} />
      <span className="flex flex-col">
        <Palabra className={cn("m-0", medida.texto)}>
          <LogotipoBeautySpot tono={tono} />
        </Palabra>
        {bajada && (
          <span className="text-muted-foreground text-xs">{bajada}</span>
        )}
      </span>
    </span>
  );
}
