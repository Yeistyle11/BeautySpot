import { Spinner } from "@/components/ui/spinner";
/** Espera del escaparate mientras Next resuelve la pagina. */
export default function MarketplaceLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner variant="inline" className="h-8 w-8 border-4" />
    </div>
  );
}
