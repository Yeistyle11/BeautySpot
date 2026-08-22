"use client";

// Selector del negocio sobre el que se trabaja, para quien tiene membresia en
// mas de uno.
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { z } from "zod";
import { useApi } from "@/lib/swr";
import { useAuthStore } from "@/lib/store";
import { ROLES } from "@/lib/auth";
import { getDefaultPath } from "@/lib/permissions";

// De esta respuesta salen el negocio y el rol activos, asi que un cambio de
// contrato aqui decide permisos: se valida antes de dejarla entrar.
const membresiaSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  businessName: z.string(),
  role: z.enum(ROLES),
});
const membresiasSchema = z.array(membresiaSchema);

type Membresia = z.infer<typeof membresiaSchema>;

/**
 * Cambia el negocio activo. Se oculta con una sola membresia: quien trabaja en
 * un unico sitio no tiene nada que elegir.
 */
export function BusinessSwitcher() {
  const router = useRouter();
  const { businessId, setNegocioActivo } = useAuthStore();
  const { data: membresias } = useApi<Membresia[]>(
    "/auth/users/memberships",
    undefined,
    membresiasSchema
  );

  if (!membresias || membresias.length < 2) return null;

  const cambiar = (nuevo: string) => {
    const membresia = membresias.find((m) => m.businessId === nuevo);
    if (!membresia) return;

    setNegocioActivo(membresia.businessId, membresia.role);
    // El rol puede ser otro en el negocio nuevo, asi que la pagina actual
    // quiza ya no le corresponda.
    router.push(getDefaultPath(membresia.role));
    router.refresh();
  };

  return (
    <div className="px-3 py-2">
      <label
        htmlFor="business-switcher"
        className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium"
      >
        <Building2 className="h-3.5 w-3.5" />
        Negocio
      </label>
      <select
        id="business-switcher"
        value={businessId ?? ""}
        onChange={(e) => cambiar(e.target.value)}
        className="border-input bg-background focus:ring-ring h-9 w-full rounded-md border px-2 text-sm focus:outline-none focus:ring-2"
      >
        {membresias.map((m) => (
          <option key={m.businessId} value={m.businessId}>
            {m.businessName || m.businessId}
          </option>
        ))}
      </select>
    </div>
  );
}
