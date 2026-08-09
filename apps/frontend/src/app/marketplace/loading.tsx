import { Spinner } from "@/components/ui/spinner";
// Estado de carga (spinner) de las paginas del marketplace.
export default function MarketplaceLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner variant="inline" className="h-8 w-8 border-4" />
    </div>
  );
}
