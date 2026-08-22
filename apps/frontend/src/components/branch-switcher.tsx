"use client";

// Selector de la sede sobre la que se trabaja, para negocios con varios locales.
import { MapPin } from "lucide-react";
import { z } from "zod";
import { useApi, revalidateAll } from "@/lib/swr";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/lib/store";

const sedeSchema = z.object({
  id: z.string(),
  name: z.string(),
});
const sedesSchema = z.array(sedeSchema);

type Sede = z.infer<typeof sedeSchema>;

/** Cambia la sede activa. Se oculta si el negocio tiene una sola sede. */
export function BranchSwitcher() {
  const { branchId, role, setSedeActiva } = useAuthStore();
  // El listado de sedes no se pide para el rol CLIENT.
  const { data: sedes } = useApi<Sede[]>(
    role && role !== "CLIENT" ? "/core/branches" : null,
    undefined,
    sedesSchema
  );

  if (!sedes || sedes.length < 2) return null;

  const cambiar = (nueva: string) => {
    setSedeActiva(nueva || null);
    // Recarga lo cacheado con el ambito nuevo.
    void revalidateAll();
  };

  return (
    <div className="px-3 py-2">
      <label
        htmlFor="branch-switcher"
        className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium"
      >
        <MapPin className="h-3.5 w-3.5" />
        Sede
      </label>
      <Select
        id="branch-switcher"
        value={branchId ?? ""}
        onChange={(e) => cambiar(e.target.value)}
        className="h-9 px-2"
      >
        <option value="">Todas las sedes</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
