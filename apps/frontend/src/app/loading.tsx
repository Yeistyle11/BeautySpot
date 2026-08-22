import { Spinner } from "@/components/ui/spinner";
export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner variant="inline" className="h-8 w-8 border-4" />
    </div>
  );
}
