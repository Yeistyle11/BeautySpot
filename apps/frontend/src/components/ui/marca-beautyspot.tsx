import Link from "next/link";
import { Scissors } from "lucide-react";

/** La marca que encabeza las pantallas de acceso, enlazada al inicio. */
export function MarcaBeautySpot() {
  return (
    <Link
      href="/"
      aria-label="Ir al inicio de BeautySpot"
      className="focus-visible:ring-ring mb-8 flex items-center justify-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2"
    >
      <div className="bg-primary text-primary-foreground shadow-flat flex h-12 w-12 items-center justify-center rounded-xl">
        <Scissors className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-foreground text-2xl font-bold">BeautySpot</h1>
        <p className="text-muted-foreground text-xs">Gestión para tu negocio</p>
      </div>
    </Link>
  );
}
