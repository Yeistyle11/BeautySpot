"use client";

// Pagina de configuracion: pestanas de cuenta, negocio y horarios.
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import { AccountTab } from "./account-tab";
import { BusinessTab } from "./business-tab";
import { HoursTab } from "./hours-tab";
import {
  businessDataSchema,
  businessHourSchema,
  DAYS,
  defaultHours,
  type BusinessData,
  type BusinessHour,
  type Feedback,
} from "./schemas";

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
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback | null>(
    null
  );

  const canSeeBusiness =
    canDo(role, "business_edit") || canDo(role, "business_hours_edit");
  const businessKey =
    businessId && canSeeBusiness ? `/core/businesses/${businessId}` : null;
  const hoursKey = canSeeBusiness ? "/core/business-hours" : null;

  const { data: business, mutate: mutateBusiness } =
    useApi<BusinessData | null>(
      businessKey,
      undefined,
      businessDataSchema.nullable()
    );
  const { data: hoursData, mutate: mutateHours } = useApi<
    BusinessHour[] | null
  >(hoursKey, undefined, z.array(businessHourSchema).nullable());

  const [businessForm, setBusinessForm] = useState<Partial<BusinessData>>({});
  const [hours, setHours] = useState<BusinessHour[]>(defaultHours);

  const loadingBiz = canSeeBusiness && !business;

  // Los formularios se siembran una sola vez, cuando el dato llega del
  // backend. Sin el guard, cada revalidacion de SWR pisaria lo que el usuario
  // esta escribiendo en ese momento.
  const businessSeeded = useRef(false);
  const hoursSeeded = useRef(false);

  useEffect(() => {
    if (!business || businessSeeded.current) return;
    businessSeeded.current = true;
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
  }, [business]);

  useEffect(() => {
    if (!hoursData || hoursData.length === 0 || hoursSeeded.current) return;
    hoursSeeded.current = true;
    setHours(
      DAYS.map(
        (d) =>
          hoursData.find((h) => h.dayOfWeek === d.value) || {
            dayOfWeek: d.value,
            openTime: "08:00",
            closeTime: "18:00",
            active: false,
          }
      )
    );
  }, [hoursData]);

  const saveAccount = async () => {
    setSaving("account");
    try {
      await api.patch("/auth/users/me", accountForm);
    } catch (err) {
      logger.error(err);
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async () => {
    setPasswordFeedback(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Las contrasenas no coinciden",
      });
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
      setPasswordFeedback({
        type: "success",
        message: "Contrasena actualizada",
      });
    } catch (err) {
      logger.error(err);
      setPasswordFeedback({
        type: "error",
        message: getErrorMessage(err, "No se pudo actualizar la contrasena"),
      });
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
      logger.error(err);
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
      logger.error(err);
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
          <AccountTab
            email={user?.email || ""}
            account={accountForm}
            onAccountChange={setAccountForm}
            onSaveAccount={saveAccount}
            savingAccount={saving === "account"}
            password={passwordForm}
            onPasswordChange={setPasswordForm}
            onChangePassword={changePassword}
            savingPassword={saving === "password"}
            passwordFeedback={passwordFeedback}
            role={role}
          />
        </TabsContent>

        <TabsContent value="business">
          {canDo(role, "business_edit") && (
            <BusinessTab
              form={businessForm}
              onChange={setBusinessForm}
              onSave={saveBusiness}
              saving={saving === "business"}
              loading={loadingBiz}
              role={role}
            />
          )}
        </TabsContent>

        <TabsContent value="hours">
          {canDo(role, "business_hours_edit") && (
            <HoursTab
              hours={hours}
              onUpdate={updateHour}
              onSave={saveHours}
              saving={saving === "hours"}
              role={role}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
