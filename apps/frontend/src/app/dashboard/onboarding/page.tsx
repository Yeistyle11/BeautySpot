"use client";

// Alta del negocio propio: la puerta de entrada de quien se registra para
// gestionar su local y todavia solo tiene cuenta de cliente.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Store, Loader2 } from "lucide-react";
import { api, apiPublic } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { logger } from "@/lib/logger";
import { mensajeDeError } from "@/lib/error-message";
import { useToast } from "@/components/ui/toast";
import { TIPOS_DE_NEGOCIO } from "@beautyspot/shared-constants";

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { setBusinessId, setRole } = useAuthStore();

  const [form, setForm] = useState({
    name: "",
    businessType: "BARBERIA",
    phone: "",
    city: "",
    address: "",
    description: "",
    /** Nace con el catálogo y el horario típicos de su tipo. */
    sembrar: true,
  });
  const [saving, setSaving] = useState(false);

  const set = (cambios: Partial<typeof form>) =>
    setForm((actual) => ({ ...actual, ...cambios }));

  const etiquetaDelTipo =
    TIPOS_DE_NEGOCIO.find((t) => t.valor === form.businessType)?.etiqueta ??
    "El negocio";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const negocio = await api.post<{ id: string }>("/core/businesses", {
        name: form.name,
        businessType: form.businessType,
        phone: form.phone || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
        description: form.description || undefined,
        sembrar: form.sembrar,
      });

      // El token vigente todavia dice CLIENT y sin negocio. Se renueva para
      // entrar al panel ya como duena o dueno de lo que se acaba de crear.
      await apiPublic.post("/auth/refresh", {});
      setBusinessId(negocio.id);
      setRole("OWNER");

      router.push("/dashboard");
    } catch (err: unknown) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Crea tu negocio</h1>
        <p className="text-muted-foreground">
          Con esto tendras tu agenda, tu equipo y tu caja. Puedes cambiar
          cualquier dato despues.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4" />
            Datos del negocio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre del negocio *">
                <Input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Barberia El Buen Corte"
                  maxLength={200}
                  required
                />
              </Field>
              <Field label="Tipo de negocio">
                <Select
                  value={form.businessType}
                  onChange={(e) => set({ businessType: e.target.value })}
                >
                  {TIPOS_DE_NEGOCIO.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Teléfono">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="+57 300 1234567"
                  maxLength={30}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                  placeholder="Bogota"
                  maxLength={100}
                />
              </Field>
            </div>
            <Field label="Dirección">
              <Input
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="Calle 10 #43-25"
                maxLength={255}
              />
            </Field>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium" id="sembrar">
                  Empezar con servicios de ejemplo
                </p>
                <p className="text-muted-foreground text-xs">
                  {/* Un panel de quince secciones vacías y ninguna pista de por
                      dónde empezar es donde se pierde a un cliente nuevo. */}
                  {etiquetaDelTipo} nace con un catálogo típico de su sector,
                  sus categorías y un horario de apertura. Todo se puede cambiar
                  o borrar después.
                </p>
              </div>
              <Switch
                checked={form.sembrar}
                onCheckedChange={(sembrar) => set({ sembrar })}
                aria-labelledby="sembrar"
              />
            </div>

            <Field label="Descripción">
              <Textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={3}
                maxLength={1000}
                placeholder="Que ofrece tu negocio"
              />
            </Field>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear negocio
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
