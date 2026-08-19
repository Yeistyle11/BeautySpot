"use client";

// Pagina de configuracion: pestanas de cuenta, negocio y horarios.
import { useEffect, useRef, useState } from "react";
import { mensajeDeError } from "@/lib/error-message";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Building2,
  Clock,
  ClipboardList,
  Award,
  Receipt,
  CalendarX,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { AccountTab } from "./account-tab";
import { BusinessTab } from "./business-tab";
import { HoursTab } from "./hours-tab";
import { FieldsTab, type NuevoCampo } from "./fields-tab";
import { LoyaltyTab } from "./loyalty-tab";
import { BillingTab } from "./billing-tab";
import { SpecialDaysCard } from "./special-days-card";
import { BookingRulesTab } from "./booking-rules-tab";
import { FIDELIZACION_KEY, nivelSchema, type Nivel } from "@/lib/niveles";
import {
  businessDataSchema,
  businessHourSchema,
  campoDeFichaSchema,
  servicioBreveSchema,
  DAYS,
  defaultHours,
  type BusinessData,
  type BusinessHour,
  type CampoDeFicha,
  type ServicioBreve,
  type Feedback,
  facturacionSchema,
  reservasSchema,
  diaEspecialSchema,
  DIAS_ESPECIALES_KEY,
  type DiaEspecial,
  type NuevoDiaEspecial,
  FACTURACION_KEY,
  RESERVAS_KEY,
  type Facturacion,
  type Reservas,
} from "./schemas";

export default function SettingsPage() {
  const toast = useToast();
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

  // La ficha y el catalogo se piden aqui, donde vive el guardado, aunque solo
  // se usen en su pestana.
  const puedeEditarNegocio = canDo(role, "business_edit");
  const { data: campos, mutate: mutateCampos } = useApi<CampoDeFicha[] | null>(
    puedeEditarNegocio ? "/core/client-fields" : null,
    undefined,
    z.array(campoDeFichaSchema).nullable()
  );
  const { data: servicios } = useApi<ServicioBreve[] | null>(
    puedeEditarNegocio ? "/core/services" : null,
    undefined,
    z.array(servicioBreveSchema).nullable()
  );

  const { data: fidelizacion, mutate: mutateFidelizacion } = useApi<{
    niveles: Nivel[];
  } | null>(
    puedeEditarNegocio ? FIDELIZACION_KEY : null,
    undefined,
    z.object({ niveles: z.array(nivelSchema) }).nullable()
  );

  const { data: facturacionGuardada, mutate: mutateFacturacion } =
    useApi<Facturacion | null>(
      puedeEditarNegocio ? FACTURACION_KEY : null,
      undefined,
      facturacionSchema.nullable()
    );
  const { data: reservasGuardadas, mutate: mutateReservas } =
    useApi<Reservas | null>(
      puedeEditarNegocio ? RESERVAS_KEY : null,
      undefined,
      reservasSchema.nullable()
    );

  const { data: diasEspeciales, mutate: mutateDiasEspeciales } = useApi<
    DiaEspecial[] | null
  >(
    canDo(role, "business_hours_edit") ? DIAS_ESPECIALES_KEY : null,
    undefined,
    z.array(diaEspecialSchema).nullable()
  );

  const [facturacion, setFacturacion] = useState<Facturacion>({});
  const [reservas, setReservas] = useState<Reservas>({});
  const [businessForm, setBusinessForm] = useState<Partial<BusinessData>>({});
  const [hours, setHours] = useState<BusinessHour[]>(defaultHours);
  const [niveles, setNiveles] = useState<Nivel[]>([]);

  const loadingBiz = canSeeBusiness && !business;

  // Siembra los formularios una sola vez, cuando el dato llega del backend.
  const businessSeeded = useRef(false);
  const hoursSeeded = useRef(false);
  const nivelesSeeded = useRef(false);
  const facturacionSeeded = useRef(false);
  const reservasSeeded = useRef(false);

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

  useEffect(() => {
    if (!fidelizacion || nivelesSeeded.current) return;
    nivelesSeeded.current = true;
    setNiveles(fidelizacion.niveles);
  }, [fidelizacion]);

  useEffect(() => {
    if (!facturacionGuardada || facturacionSeeded.current) return;
    facturacionSeeded.current = true;
    setFacturacion(facturacionGuardada);
  }, [facturacionGuardada]);

  useEffect(() => {
    if (!reservasGuardadas || reservasSeeded.current) return;
    reservasSeeded.current = true;
    setReservas(reservasGuardadas);
  }, [reservasGuardadas]);

  const saveAccount = async () => {
    setSaving("account");
    try {
      await api.patch("/auth/users/me", accountForm);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async () => {
    setPasswordFeedback(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Las contraseñas no coinciden",
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
        message: "Contraseña actualizada",
      });
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
      setPasswordFeedback({
        type: "error",
        message: mensajeDeError(err, "No se pudo actualizar la contraseña"),
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
      toast.error(mensajeDeError(err));
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
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const saveNiveles = async () => {
    setSaving("loyalty");
    try {
      await api.patch(FIDELIZACION_KEY, { niveles });
      await mutateFidelizacion();
      toast.exito("Niveles actualizados");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const crearDiaEspecial = async (dia: NuevoDiaEspecial) => {
    setSaving("special");
    try {
      await api.post(DIAS_ESPECIALES_KEY, {
        startDate: dia.startDate,
        endDate: dia.endDate,
        closed: dia.closed,
        motivo: dia.motivo.trim(),
        ...(dia.closed
          ? {}
          : { openTime: dia.openTime, closeTime: dia.closeTime }),
      });
      await mutateDiasEspeciales();
      toast.exito("Día especial añadido");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const quitarDiaEspecial = async (id: string) => {
    try {
      await api.delete(`${DIAS_ESPECIALES_KEY}/${id}`);
      await mutateDiasEspeciales();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const saveFacturacion = async () => {
    setSaving("billing");
    try {
      await api.patch(FACTURACION_KEY, facturacion);
      await mutateFacturacion();
      toast.exito("Datos de facturación actualizados");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const saveReservas = async () => {
    setSaving("booking");
    try {
      await api.patch(RESERVAS_KEY, reservas);
      await mutateReservas();
      toast.exito("Reglas de reserva actualizadas");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const crearCampo = async (campo: NuevoCampo) => {
    setSaving("fields");
    try {
      await api.post("/core/client-fields", {
        etiqueta: campo.etiqueta.trim(),
        tipo: campo.tipo,
        obligatorio: campo.obligatorio,
        // El backend cuenta la lista vacía como "aplica a todos", pero prefiere
        // no recibirla a recibirla vacía.
        serviceIds: campo.serviceIds.length > 0 ? campo.serviceIds : undefined,
        opciones:
          campo.tipo === "opciones"
            ? campo.opciones
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      });
      await mutateCampos();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const quitarCampo = async (id: string) => {
    try {
      await api.delete(`/core/client-fields/${id}`);
      await mutateCampos();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
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
        <h1 className="text-2xl font-bold">Configuración</h1>
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
          {canDo(role, "business_edit") && (
            <TabsTrigger value="fields" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Ficha
            </TabsTrigger>
          )}
          {canDo(role, "business_edit") && (
            <TabsTrigger value="loyalty" className="gap-2">
              <Award className="h-4 w-4" /> Fidelidad
            </TabsTrigger>
          )}
          {canDo(role, "business_edit") && (
            <TabsTrigger value="billing" className="gap-2">
              <Receipt className="h-4 w-4" /> Facturación
            </TabsTrigger>
          )}
          {canDo(role, "business_edit") && (
            <TabsTrigger value="booking" className="gap-2">
              <CalendarX className="h-4 w-4" /> Reservas
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

        <TabsContent value="hours" className="space-y-4">
          {canDo(role, "business_hours_edit") && (
            <>
              <HoursTab
                hours={hours}
                onUpdate={updateHour}
                onSave={saveHours}
                saving={saving === "hours"}
                role={role}
              />
              <SpecialDaysCard
                dias={diasEspeciales ?? []}
                onCreate={crearDiaEspecial}
                onRemove={quitarDiaEspecial}
                saving={saving === "special"}
                role={role}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="fields">
          {canDo(role, "business_edit") && (
            <FieldsTab
              campos={campos ?? []}
              servicios={servicios ?? []}
              onCreate={crearCampo}
              onRemove={quitarCampo}
              saving={saving === "fields"}
              role={role}
            />
          )}
        </TabsContent>

        <TabsContent value="loyalty">
          {canDo(role, "business_edit") && (
            <LoyaltyTab
              niveles={niveles}
              onChange={setNiveles}
              onSave={saveNiveles}
              saving={saving === "loyalty"}
              role={role}
            />
          )}
        </TabsContent>

        <TabsContent value="billing">
          {canDo(role, "business_edit") && (
            <BillingTab
              facturacion={facturacion}
              onChange={setFacturacion}
              onSave={saveFacturacion}
              saving={saving === "billing"}
              role={role}
            />
          )}
        </TabsContent>

        <TabsContent value="booking">
          {canDo(role, "business_edit") && (
            <BookingRulesTab
              reservas={reservas}
              onChange={setReservas}
              onSave={saveReservas}
              saving={saving === "booking"}
              role={role}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
