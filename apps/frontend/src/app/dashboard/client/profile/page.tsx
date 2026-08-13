"use client";

// Perfil del cliente: edicion de sus datos personales.
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Award, Save, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { mensajeDeError } from "@/lib/error-message";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/store";
import { useApi } from "@/lib/swr";
import { Spinner } from "@/components/ui/spinner";
import { CLASE_DE_COLOR, nivelSchema } from "@/lib/niveles";
import { PROPORCION_PUNTOS_FIDELIDAD } from "@beautyspot/shared-constants";
import { formatCurrency } from "@/lib/utils";

const clientProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  loyaltyPoints: z.number(),
  // El nivel lo resuelve core contra la escala del negocio, que el cliente no
  // puede leer.
  nivel: nivelSchema.nullable(),
  siguienteNivel: nivelSchema.nullable(),
});
type ClientProfile = z.infer<typeof clientProfileSchema>;

/** Lo que hay que gastar para ganar un punto, en la moneda del negocio. */
const GASTO_POR_PUNTO = Math.round(1 / PROPORCION_PUNTOS_FIDELIDAD);

export default function ClientProfilePage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const {
    data: client,
    isLoading: loading,
    mutate: mutateClient,
  } = useApi<ClientProfile | null>(
    "/core/clients/me",
    undefined,
    clientProfileSchema.nullable()
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  // El formulario se siembra una sola vez, con lo primero que llegue: el perfil
  // del backend si responde, y si no los datos de la sesion. Sin el guard, cada
  // revalidacion de SWR pisaria lo que el usuario esta escribiendo.
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    if (client) {
      seeded.current = true;
      setForm({ name: client.name, phone: client.phone || "" });
    } else if (user) {
      seeded.current = true;
      setForm({ name: user.name || "", phone: user.phone || "" });
    }
  }, [client, user]);

  // Un cliente que reservo como invitado todavia no tiene ficha en core-service,
  // asi que si ese endpoint no lo encuentra los datos se guardan contra su
  // usuario de auth-service.
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/core/clients/me", form);
      await mutateClient();
      setSaved(true);
    } catch (errClientes: unknown) {
      logger.error(errClientes);
      try {
        await api.patch("/auth/users/me", form);
        setSaved(true);
      } catch (errUsuarios: unknown) {
        logger.error(errUsuarios);
        toast.error(mensajeDeError(errUsuarios));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner variant="inline" className="h-8 w-8 border-4" />
      </div>
    );
  }

  const loyaltyPoints = client?.loyaltyPoints || 0;
  const nivel = client?.nivel ?? null;
  const proximo = client?.siguienteNivel ?? null;

  // Lo recorrido dentro del nivel actual, no sobre el total: con Plata en 100 y
  // Oro en 300, 150 puntos son un 25 % del tramo, no la mitad.
  const avance = proximo
    ? Math.min(
        ((loyaltyPoints - (nivel?.min ?? 0)) /
          (proximo.min - (nivel?.min ?? 0))) *
          100,
        100
      )
    : 100;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Administra tu información personal
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Award className="text-primary h-5 w-5" />
              <h2 className="font-semibold">Fidelidad</h2>
            </div>

            <div
              className={`rounded-xl ${CLASE_DE_COLOR[nivel?.color ?? ""] ?? "bg-muted-foreground"} mb-4 p-5 text-white`}
            >
              {nivel && (
                <p className="text-sm font-medium opacity-90">{nivel.label}</p>
              )}
              <p className="mt-1 text-3xl font-bold">{loyaltyPoints}</p>
              <p className="mt-1 text-sm opacity-80">puntos acumulados</p>
            </div>

            {proximo ? (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Próximo: {proximo.label}
                  </span>
                  <span className="font-medium">
                    {proximo.min - loyaltyPoints} pts
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${avance}%` }}
                  />
                </div>
              </div>
            ) : (
              nivel && (
                <p className="text-muted-foreground text-center text-sm">
                  Has alcanzado el nivel máximo
                </p>
              )
            )}

            <div className="text-muted-foreground mt-4 space-y-2 text-sm">
              <p>Gana 1 punto por cada {formatCurrency(GASTO_POR_PUNTO)}</p>
              <p>Usa tus puntos para descuentos en futuras citas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="mb-6 font-semibold">Información personal</h2>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 text-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold">
                  {(form.name || user?.name || "U").charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-medium">
                    {form.name || user?.name || "Cliente"}
                  </p>
                  <p className="text-muted-foreground text-sm">{user?.email}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    Nombre completo
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    Email
                  </Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-muted-foreground text-xs">
                    El email no se puede cambiar
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    Teléfono
                  </Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+57 300 1234567"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <div className="border-primary-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  ) : saved ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving
                    ? "Guardando..."
                    : saved
                      ? "Guardado"
                      : "Guardar cambios"}
                </Button>
                {saved && (
                  <p className="text-success text-sm">
                    Cambios guardados correctamente
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
