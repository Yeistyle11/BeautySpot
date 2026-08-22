import { cn } from "@/lib/utils";

interface PageHeaderProps {
  titulo: string;
  /** Frase de apoyo bajo el titulo. */
  descripcion?: string;
  /** Boton o grupo de botones alineados a la derecha. */
  accion?: React.ReactNode;
  className?: string;
}

/** Cabecera de una pagina del panel: titulo, descripcion y accion principal. */
export function PageHeader({
  titulo,
  descripcion,
  accion,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {descripcion && <p className="text-muted-foreground">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
