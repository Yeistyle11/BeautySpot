/**
 * El isotipo de la marca: el disco y su contrapunto, el lunar que da nombre al
 * producto. La geometria vive en un lienzo de 100x100, asi que el punto guarda
 * su proporcion lo mismo a 16px de favicon que a pantalla completa.
 *
 * Los rellenos salen de los tokens del tema en vez de un fichero por variante:
 * el contrapunto es el fondo de la pagina, de modo que el disco se lee calado
 * en claro y en oscuro con un solo SVG.
 */
export function IsotipoBeautySpot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      // El nombre accesible lo pone el enlace que lo envuelve; anunciarlo aqui
      // tambien haria que el lector de pantalla dijera la marca dos veces.
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="46" fill="hsl(var(--marca))" />
      <circle cx="64" cy="34" r="13" fill="hsl(var(--background))" />
    </svg>
  );
}
