import Link from "next/link";
import { LogoBeautySpot } from "@/components/ui/logo-beautyspot";

/** La marca que encabeza las pantallas de acceso, enlazada al inicio. */
export function MarcaBeautySpot() {
  return (
    <Link
      href="/"
      aria-label="Ir al inicio de BeautySpot"
      className="focus-visible:ring-ring mb-8 flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2"
    >
      <LogoBeautySpot tamano="lg" bajada="Gestión para tu negocio" comoTitulo />
    </Link>
  );
}
