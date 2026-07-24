// Pagina 404 de la aplicacion.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <SearchX className="text-muted-foreground h-10 w-10" />
      <div>
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
