"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Award, Save, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useApi } from "@/lib/swr";

interface ClientProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  loyaltyPoints: number;
}

const LOYALTY_TIERS = [
  { min: 0, label: "Bronce", color: "bg-amber-700" },
  { min: 100, label: "Plata", color: "bg-gray-400" },
  { min: 300, label: "Oro", color: "bg-yellow-500" },
  { min: 600, label: "Platino", color: "bg-cyan-500" },
  { min: 1000, label: "Diamante", color: "bg-purple-500" },
];

function getTier(points: number) {
  let tier = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) {
    if (points >= t.min) tier = t;
  }
  return tier;
}

function getNextTier(points: number) {
  for (const t of LOYALTY_TIERS) {
    if (points < t.min) return t;
  }
  return null;
}

export default function ClientProfilePage() {
  const { user } = useAuthStore();
  const {
    data: client,
    isLoading: loading,
    mutate: mutateClient,
  } = useApi<ClientProfile | null>("/core/clients/me");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (client) {
      setForm({ name: client.name, phone: client.phone || "" });
    } else if (user && !form.name) {
      setForm({ name: user.name || "", phone: user.phone || "" });
    }
  }, [client, user, form.name]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/core/clients/me", form);
      await mutateClient();
      setSaved(true);
    } catch {
      try {
        await api.patch("/auth/users/me", form);
        setSaved(true);
      } catch {
        // silently fail
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  const loyaltyPoints = client?.loyaltyPoints || 0;
  const tier = getTier(loyaltyPoints);
  const nextTier = getNextTier(loyaltyPoints);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Administra tu informacion personal
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Loyalty card */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Award className="text-primary h-5 w-5" />
              <h2 className="font-semibold">Fidelidad</h2>
            </div>

            <div className={`rounded-xl ${tier.color} mb-4 p-5 text-white`}>
              <p className="text-sm font-medium opacity-90">{tier.label}</p>
              <p className="mt-1 text-3xl font-bold">{loyaltyPoints}</p>
              <p className="mt-1 text-sm opacity-80">puntos acumulados</p>
            </div>

            {nextTier && (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Proximo: {nextTier.label}
                  </span>
                  <span className="font-medium">
                    {nextTier.min - loyaltyPoints} pts
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((loyaltyPoints / nextTier.min) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {!nextTier && (
              <p className="text-muted-foreground text-center text-sm">
                Has alcanzado el nivel maximo
              </p>
            )}

            <div className="text-muted-foreground mt-4 space-y-2 text-sm">
              <p>Gana 1 punto por cada $1.000 COP</p>
              <p>Usa tus puntos para descuentos en futuras citas</p>
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="mb-6 font-semibold">Informacion personal</h2>

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
                    Telefono
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
                  <p className="text-sm text-emerald-600">
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
