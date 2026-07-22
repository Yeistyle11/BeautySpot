"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building2, Clock, Save, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";

interface BusinessData {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  businessType?: string;
  logo?: string;
  coverImage?: string;
}

interface BusinessHour {
  id?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  active: boolean;
}

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

const defaultHours: BusinessHour[] = DAYS.map((d) => ({
  dayOfWeek: d.value,
  openTime: "08:00",
  closeTime: "18:00",
  active: d.value >= 1 && d.value <= 5,
}));

export default function SettingsPage() {
  const { user, businessId, role } = useAuthStore();
  const [saving, setSaving] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const canSeeBusiness =
    canDo(role, "business_edit") || canDo(role, "business_hours_edit");
  const businessKey =
    businessId && canSeeBusiness ? `/core/businesses/${businessId}` : null;
  const hoursKey = canSeeBusiness ? "/core/business-hours" : null;

  const { data: business, mutate: mutateBusiness } =
    useApi<BusinessData | null>(businessKey);
  const { data: hoursData, mutate: mutateHours } = useApi<
    BusinessHour[] | null
  >(hoursKey);

  const [businessForm, setBusinessForm] = useState<Partial<BusinessData>>({});
  const [hours, setHours] = useState<BusinessHour[]>(defaultHours);

  const loadingBiz = canSeeBusiness && !business;

  useEffect(() => {
    if (business) {
      setBusinessForm({
        name: business.name,
        description: business.description,
        phone: business.phone,
        email: business.email,
        website: business.website,
        address: business.address,
        city: business.city,
        state: business.state,
        country: business.country,
        logo: business.logo,
        coverImage: business.coverImage,
      });
    }
  }, [business]);

  useEffect(() => {
    if (hoursData && hoursData.length > 0) {
      const mapped = DAYS.map((d) => {
        const existing = hoursData.find((h) => h.dayOfWeek === d.value);
        return (
          existing || {
            dayOfWeek: d.value,
            openTime: "08:00",
            closeTime: "18:00",
            active: false,
          }
        );
      });
      setHours(mapped);
    }
  }, [hoursData]);

  const saveAccount = async () => {
    setSaving("account");
    try {
      await api.patch("/auth/users/me", accountForm);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Las contrasenas no coinciden");
      return;
    }
    setSaving("password");
    try {
      await api.post("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      alert("Contrasena actualizada");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const saveBusiness = async () => {
    if (!businessId) return;
    setSaving("business");
    try {
      await api.patch(`/core/businesses/${businessId}`, businessForm);
      await mutateBusiness();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const saveHours = async () => {
    setSaving("hours");
    try {
      await api.put("/core/business-hours", { hours });
      await mutateHours();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const updateHour = (
    dayOfWeek: number,
    field: keyof BusinessHour,
    value: string | boolean
  ) => {
    setHours((prev) =>
      prev.map((h) =>
        h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
      )
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground">Ajustes de tu cuenta y negocio</p>
      </div>

      <Tabs defaultValue="account" className="max-w-3xl">
        <TabsList className="mb-4">
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" /> Mi Cuenta
          </TabsTrigger>
          {canDo(role, "business_edit") && (
            <TabsTrigger value="business" className="gap-2">
              <Building2 className="h-4 w-4" /> Negocio
            </TabsTrigger>
          )}
          {canDo(role, "business_hours_edit") && (
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="h-4 w-4" /> Horarios
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Mi cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={accountForm.name}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input
                    value={accountForm.phone}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              {canDo(role, "settings_edit") && (
                <Button onClick={saveAccount} disabled={saving === "account"}>
                  {saving === "account" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar cambios
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Cambiar contrasena</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Contrasena actual</Label>
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nueva contrasena</Label>
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar contrasena</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={changePassword}
                disabled={saving === "password"}
              >
                {saving === "password" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Cambiar contrasena
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          {canDo(role, "business_edit") &&
            (loadingBiz ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="text-muted-foreground p-8 text-center">
                  Cargando...
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Informacion del negocio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={businessForm.name || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefono</Label>
                      <Input
                        value={businessForm.phone || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={businessForm.email || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sitio web</Label>
                      <Input
                        value={businessForm.website || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            website: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Descripcion</Label>
                      <Textarea
                        value={businessForm.description || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Direccion</Label>
                      <Input
                        value={businessForm.address || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            address: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ciudad</Label>
                      <Input
                        value={businessForm.city || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            city: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Departamento</Label>
                      <Input
                        value={businessForm.state || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            state: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pais</Label>
                      <Input
                        value={businessForm.country || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            country: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Logo (URL)</Label>
                      <Input
                        value={businessForm.logo || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            logo: e.target.value,
                          })
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Imagen portada (URL)</Label>
                      <Input
                        value={businessForm.coverImage || ""}
                        onChange={(e) =>
                          setBusinessForm({
                            ...businessForm,
                            coverImage: e.target.value,
                          })
                        }
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  {canDo(role, "settings_edit") && (
                    <Button
                      onClick={saveBusiness}
                      disabled={saving === "business"}
                    >
                      {saving === "business" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Guardar cambios
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="hours">
          {canDo(role, "business_hours_edit") && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Horarios de atencion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const hour = hours.find((h) => h.dayOfWeek === day.value);
                    return (
                      <div
                        key={day.value}
                        className="flex items-center gap-4 rounded-lg border p-3"
                      >
                        <div className="w-24">
                          <span className="text-sm font-medium">
                            {day.label}
                          </span>
                        </div>
                        <Switch
                          checked={hour?.active ?? false}
                          onCheckedChange={(checked) =>
                            updateHour(day.value, "active", checked)
                          }
                        />
                        {hour?.active ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={hour.openTime}
                              onChange={(e) =>
                                updateHour(
                                  day.value,
                                  "openTime",
                                  e.target.value
                                )
                              }
                              className="h-8 w-28 text-sm"
                            />
                            <span className="text-muted-foreground">a</span>
                            <Input
                              type="time"
                              value={hour.closeTime}
                              onChange={(e) =>
                                updateHour(
                                  day.value,
                                  "closeTime",
                                  e.target.value
                                )
                              }
                              className="h-8 w-28 text-sm"
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Cerrado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {canDo(role, "settings_edit") && (
                  <Button onClick={saveHours} disabled={saving === "hours"}>
                    {saving === "hours" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Guardar horarios
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
