"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User, Mail, Phone, Award, Save, CheckCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

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
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    api.get<ClientProfile>("/core/clients/me")
      .then((data) => {
        setClient(data);
        setForm({ name: data.name, phone: data.phone || "" });
      })
      .catch(() => {
        if (user) {
          setForm({ name: user.name || "", phone: user.phone || "" });
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/core/clients/me", form);
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
        <p className="text-muted-foreground">Administra tu informacion personal</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Loyalty card */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Fidelidad</h2>
            </div>

            <div className={`rounded-xl ${tier.color} p-5 text-white mb-4`}>
              <p className="text-sm font-medium opacity-90">{tier.label}</p>
              <p className="text-3xl font-bold mt-1">{loyaltyPoints}</p>
              <p className="text-sm opacity-80 mt-1">puntos acumulados</p>
            </div>

            {nextTier && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Proximo: {nextTier.label}</span>
                  <span className="font-medium">{nextTier.min - loyaltyPoints} pts</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((loyaltyPoints / nextTier.min) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {!nextTier && (
              <p className="text-sm text-muted-foreground text-center">
                Has alcanzado el nivel maximo
              </p>
            )}

            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>Gana 1 punto por cada $1.000 COP</p>
              <p>Usa tus puntos para descuentos en futuras citas</p>
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-6">Informacion personal</h2>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">
                  {(form.name || user?.name || "U").charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-lg">{form.name || user?.name || "Cliente"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
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
                  <Input value={user?.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    Telefono
                  </Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+57 300 1234567"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : saved ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Guardando..." : saved ? "Guardado" : "Guardar cambios"}
                </Button>
                {saved && (
                  <p className="text-sm text-emerald-600">Cambios guardados correctamente</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
