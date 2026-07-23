"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { apiPublic, api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { getErrorMessage } from "@/lib/utils";
import { useApiPublic, revalidatePrefix } from "@/lib/swr";
import { BookingConfirmation } from "./booking-confirmation";
import { SelectServicesStep } from "./steps/select-services-step";
import { SelectProfessionalStep } from "./steps/select-professional-step";
import { SelectSlotStep } from "./steps/select-slot-step";
import {
  GuestDetailsStep,
  type GuestDetails,
} from "./steps/guest-details-step";
import {
  BOOKING_STEPS,
  generateFallbackSlots,
  professionalSchema,
  profileSchema,
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

  const { data: profile, isLoading: loading } = useApiPublic<Profile>(
    `/marketplace/profiles/${slug}`,
    undefined,
    profileSchema
  );
  const { data: rawServices } = useApiPublic<Service[]>(
    profile?.businessId
      ? `/core/public/businesses/${profile.businessId}/services`
      : null,
    undefined,
    z.array(serviceSchema)
  );
  const { data: rawProfessionals } = useApiPublic<Professional[]>(
    profile?.businessId
      ? `/marketplace/professional-profiles/business/${profile.businessId}`
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

  const isAnyProfessional = selectedProfessional === "any";
  const slotsKey =
    date && selectedProfessional && totalDuration > 0 && !isAnyProfessional
      ? `/booking/appointments/availability?professionalId=${selectedProfessional}&date=${date}&duration=${totalDuration}`
      : null;
  const { data: rawSlots, isLoading: slotsLoading } = useApiPublic<string[]>(
    slotsKey,
    undefined,
    z.array(z.string())
  );
  const availableSlots =
    isAnyProfessional && date ? generateFallbackSlots() : (rawSlots ?? []);

  // Cambiar de fecha, profesional o servicios invalida la hora ya elegida.
  useEffect(() => {
    setStartTime("");
  }, [date, selectedProfessional, totalDuration]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setGuest({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
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
      const body: Record<string, unknown> = {
        businessId: profile.businessId,
        professionalId: selectedProfessional,
        serviceIds: selectedServiceData.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
        })),
        date,
        startTime,
      };

      // Con sesion la cita se asocia al cliente; sin ella viaja como invitado
      // por un endpoint publico distinto.
      if (isAuthenticated && user) {
        body.clientId = user.id;
      } else {
        body.guestName = guest.name;
        body.guestEmail = guest.email || undefined;
        body.guestPhone = guest.phone || undefined;
      }

      const result = await (isAuthenticated
        ? api.post<Confirmation>("/booking/appointments", body)
        : apiPublic.post<Confirmation>("/booking/public/appointments", body));
      setConfirmation(result);
      await revalidatePrefix("/booking/appointments");
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear la reserva"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
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
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      }
    >
      <PublicBookingPageInner />
    </Suspense>
  );
}
