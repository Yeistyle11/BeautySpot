"use client";

// Flujo de reserva publica: asistente por pasos (servicios, profesional, horario y datos) hasta confirmar la cita.
import { useEffect, useRef, useState, Suspense } from "react";
import { mensajeDeError } from "@/lib/error-message";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { apiPublic } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useApiPublic, revalidatePrefix } from "@/lib/swr";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import {
  availabilitySlotSchema,
  type AvailabilitySlot,
} from "@/lib/schemas/appointment";
import { BookingConfirmation } from "./booking-confirmation";
import { SelectServicesStep } from "./steps/select-services-step";
import { SelectProfessionalStep } from "./steps/select-professional-step";
import { SelectSlotStep } from "./steps/select-slot-step";
import {
  GuestDetailsStep,
  type GuestDetails,
} from "./steps/guest-details-step";
import { Spinner } from "@/components/ui/spinner";
import {
  BOOKING_STEPS,
  professionalSchema,
  profileResponseSchema,
  serviceSchema,
  type BookingConfirmation as Confirmation,
  type Profile,
  type Professional,
  type Service,
} from "./schemas";

function PublicBookingPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const preselectedProfId = searchParams.get("professionalId") || "";

  const { user, hydrated } = useAuthStore();
  const isAuthenticated = hydrated && !!user;

  const {
    data: profileResponse,
    isLoading: loading,
    error: profileError,
    mutate: recargarPerfil,
  } = useApiPublic(
    `/marketplace/profiles/${slug}`,
    undefined,
    profileResponseSchema
  );
  const profile: Profile | undefined = profileResponse?.profile;
  const { data: rawServices } = useApiPublic<Service[]>(
    profile?.businessId
      ? `/core/public/businesses/${profile.businessId}/services`
      : null,
    undefined,
    z.array(serviceSchema)
  );
  const { data: rawProfessionals } = useApiPublic<Professional[]>(
    profile?.businessId
      ? `/core/public/businesses/${profile.businessId}/professionals`
      : null,
    undefined,
    z.array(professionalSchema)
  );

  const services = (rawServices ?? []).map((s) => ({
    ...s,
    price: Number(s.price),
  }));
  // El perfil publico y el profesional son entidades distintas; para reservar
  // hace falta el id del profesional, no el del perfil.
  const professionals = (rawProfessionals ?? []).map((p) => ({
    ...p,
    id: p.professionalId || p.id,
    specialties: p.specialties || [],
  }));

  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] =
    useState(preselectedProfId);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [guest, setGuest] = useState<GuestDetails>({
    name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState("");

  const selectedServiceData = services.filter((s) =>
    selectedServices.includes(s.id)
  );
  const totalDuration = selectedServiceData.reduce(
    (sum, s) => sum + s.duration,
    0
  );
  const totalAmount = selectedServiceData.reduce((sum, s) => sum + s.price, 0);

  // Con "cualquier profesional" la disponibilidad se pide del negocio entero, que
  // devuelve la union de las agendas; con uno concreto, solo la suya.
  const isAnyProfessional = selectedProfessional === "any";
  const alcanceSlots = isAnyProfessional
    ? `businessId=${profile?.businessId}`
    : `professionalId=${selectedProfessional}`;
  // Sin fecha, sin profesional o sin servicios elegidos no hay nada que
  // consultar: la key en null deja la peticion sin lanzar.
  const slotsKey =
    date && selectedProfessional && totalDuration > 0 && profile?.businessId
      ? `/booking/appointments/availability?${alcanceSlots}&date=${date}&duration=${totalDuration}`
      : null;
  const { data: rawSlots, isLoading: slotsLoading } = useApiPublic<
    AvailabilitySlot[]
  >(slotsKey, undefined, z.array(availabilitySlotSchema));
  const availableSlots = (rawSlots ?? [])
    .filter((s) => s.available)
    .map((s) => s.startTime);

  // Cambiar de fecha, profesional o servicios invalida la hora ya elegida.
  useEffect(() => {
    setStartTime("");
  }, [date, selectedProfessional, totalDuration]);

  // Los datos del usuario se copian al formulario una sola vez: si el store se
  // rehidrata mas tarde, no debe pisar lo que ya haya corregido a mano.
  const datosSembrados = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !user || datosSembrados.current) return;
    datosSembrados.current = true;
    setGuest({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    });
  }, [isAuthenticated, user]);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!profile) return;
    setError("");
    setSubmitting(true);
    try {
      // La ruta es publica y sin token: no se manda el id del usuario.
      const identidad =
        isAuthenticated && user
          ? {
              guestName: user.name,
              guestEmail: user.email || undefined,
              guestPhone: user.phone || undefined,
            }
          : {
              guestName: guest.name,
              guestEmail: guest.email || undefined,
              guestPhone: guest.phone || undefined,
            };

      const body: Record<string, unknown> = {
        businessId: profile.businessId,
        professionalId: isAnyProfessional ? undefined : selectedProfessional,
        // Solo los ids: el precio y la duración los pone el catálogo.
        serviceIds: selectedServices,
        date,
        startTime,
        ...identidad,
      };

      const result = await apiPublic.post<Confirmation>(
        "/booking/public/appointments",
        body
      );
      setConfirmation(result);
      await revalidatePrefix("/booking/appointments");
    } catch (err) {
      setError(mensajeDeError(err, "Error al crear la reserva"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner variant="inline" className="h-8 w-8 border-4" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <ErrorDeCarga
          error={profileError}
          recurso="los datos del negocio"
          onReintentar={() => recargarPerfil()}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-muted-foreground py-20 text-center">
        <p>Negocio no encontrado</p>
        <Link
          href="/marketplace"
          className="text-primary mt-2 inline-block hover:underline"
        >
          Volver al marketplace
        </Link>
      </div>
    );
  }

  if (confirmation) {
    return (
      <BookingConfirmation
        confirmation={confirmation}
        businessName={profile.name}
        slug={slug}
        date={date}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/marketplace/business/${slug}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al negocio
      </Link>

      <h1 className="mb-2 text-2xl font-bold">
        Agendar cita en {profile.name}
      </h1>

      <ol className="mb-8 flex gap-2">
        {BOOKING_STEPS.map((s) => (
          <li
            key={s.n}
            aria-current={step === s.n ? "step" : undefined}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors ${
              step >= s.n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s.n}. {s.label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <SelectServicesStep
          services={services}
          selected={selectedServices}
          onToggle={toggleService}
          totalAmount={totalAmount}
          totalDuration={totalDuration}
          // Si el profesional venia preseleccionado desde su ficha, se salta
          // el paso 2.
          onContinue={() => setStep(selectedProfessional ? 3 : 2)}
        />
      )}

      {step === 2 && (
        <SelectProfessionalStep
          professionals={professionals}
          selected={selectedProfessional}
          onSelect={setSelectedProfessional}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <SelectSlotStep
          date={date}
          onDateChange={setDate}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          availableSlots={availableSlots}
          slotsLoading={slotsLoading}
          isAnyProfessional={isAnyProfessional}
          onBack={() => setStep(2)}
          onContinue={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <GuestDetailsStep
          selectedServices={selectedServiceData}
          date={date}
          startTime={startTime}
          totalDuration={totalDuration}
          totalAmount={totalAmount}
          user={isAuthenticated && user ? user : null}
          guest={guest}
          onGuestChange={setGuest}
          error={error}
          submitting={submitting}
          onBack={() => setStep(3)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

export default function PublicBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner variant="inline" className="h-8 w-8 border-4" />
        </div>
      }
    >
      <PublicBookingPageInner />
    </Suspense>
  );
}
