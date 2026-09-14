"use client";

// Flujo de reserva publica: asistente por pasos (servicios, profesional, horario y datos) hasta confirmar la cita.
import { useEffect, useMemo, useState, Suspense } from "react";
import { mensajeDeError } from "@/lib/error-message";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { z } from "zod";
import { api, apiPublic } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { desplazarDia, esDiaCerrado, toLocalDateKey } from "@/lib/utils";
import { useApiPublic, revalidatePrefix } from "@/lib/swr";
import { useSeededForm } from "@/lib/use-seeded-form";
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
  jornadaPublicaSchema,
  professionalSchema,
  profileResponseSchema,
  serviceSchema,
  type BookingConfirmation as Confirmation,
  type JornadaPublica,
  type Profile,
  type Professional,
  type Service,
} from "./schemas";

/** Dias que se miran para proponer el primero en el que el negocio abre. */
const DIAS_PARA_PROPONER = 14;

function PublicBookingPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedProfId = searchParams.get("professionalId") || "";
  // Admite varios: `?serviceId=a&serviceId=b` llega de la ficha del negocio.
  const serviciosPreelegidos = searchParams.getAll("serviceId");
  // Primera lectura de lo que el asistente guarda en la URL; los datos de
  // quien reserva se quedan fuera.
  const [inicial] = useState(() => ({
    paso: Number(searchParams.get("paso")) || 1,
    fecha: searchParams.get("fecha") ?? "",
    hora: searchParams.get("hora") ?? "",
  }));

  const { user, role, hydrated } = useAuthStore();
  const isAuthenticated = hydrated && !!user;
  // Con cuenta de cliente la cita se liga a la cuenta; el resto reserva como
  // invitado.
  const reservaComoCliente = isAuthenticated && role === "CLIENT";

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
  const { data: rawProfessionals } = useApiPublic<Professional[]>(
    profile?.businessId
      ? `/core/public/businesses/${profile.businessId}/professionals`
      : null,
    undefined,
    z.array(professionalSchema)
  );

  const { data: horarios } = useApiPublic<JornadaPublica[]>(
    profile?.businessId
      ? `/core/public/businesses/${profile.businessId}/horarios`
      : null,
    undefined,
    z.array(jornadaPublicaSchema)
  );

  /** Días con hueco, con la cola de las nocturnas; `undefined` sin cargar. */
  const diasAbiertos = useMemo(() => {
    if (!horarios) return undefined;

    const dias = new Set<number>();
    for (const jornada of horarios) {
      dias.add(jornada.dayOfWeek);
      if (jornada.closeTime <= jornada.openTime) {
        dias.add((jornada.dayOfWeek + 1) % 7);
      }
    }
    return [...dias];
  }, [horarios]);

  /** El primer dia con jornada a partir de hoy, que es el que se propone. */
  const primerDiaAbierto = useMemo(() => {
    if (!diasAbiertos?.length) return "";

    const hoy = toLocalDateKey(new Date());
    for (let i = 0; i < DIAS_PARA_PROPONER; i++) {
      const candidato = desplazarDia(hoy, i);
      if (!esDiaCerrado(candidato, diasAbiertos)) return candidato;
    }
    return "";
  }, [diasAbiertos]);

  // El perfil publico y el profesional son entidades distintas; para reservar
  // hace falta el id del profesional, no el del perfil.
  const professionals = (rawProfessionals ?? []).map((p) => ({
    ...p,
    id: p.professionalId || p.id,
    specialties: p.specialties || [],
  }));

  // El paso sale de la URL; lo demas que se elige vive en el componente.
  const step = Math.min(
    Math.max(Number(searchParams.get("paso")) || 1, 1),
    BOOKING_STEPS.length
  );
  const [selectedServices, setSelectedServices] =
    useState<string[]>(serviciosPreelegidos);
  const [selectedProfessional, setSelectedProfessional] =
    useState(preselectedProfId);
  const [fechaElegida, setDate] = useState(inicial.fecha);
  /** La elegida, o la que se propone mientras nadie toca la fecha. */
  const date = fechaElegida || primerDiaAbierto;
  // La hora se guarda junto a la combinacion con la que se eligio, para poder
  // derivar si sigue valiendo en vez de tener que borrarla desde un efecto.
  const [horaElegida, setHoraElegida] = useState({
    combinacion: "",
    startTime: inicial.hora,
  });
  const [guest, setGuest] = useState<GuestDetails>({
    name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState("");

  const isAnyProfessional = selectedProfessional === "any";

  // Los servicios se piden con la tarifa del profesional elegido: la agenda cobra
  // el precio del par servicio-profesional, y la duracion tambien es la suya, que
  // es de donde salen los huecos que se ofrecen.
  const serviciosKey = profile?.businessId
    ? `/core/public/businesses/${profile.businessId}/services` +
      (selectedProfessional && !isAnyProfessional
        ? `?professionalId=${selectedProfessional}`
        : "")
    : null;
  const { data: rawServices } = useApiPublic<Service[]>(
    serviciosKey,
    undefined,
    z.array(serviceSchema)
  );

  const services = (rawServices ?? []).map((s) => ({
    ...s,
    price: Number(s.price),
  }));

  // Con «cualquier profesional» el precio aun no esta decidido: lo elige el
  // servidor al reservar, y con el la tarifa.
  const precioPorConfirmar =
    isAnyProfessional && services.some((s) => s.precioVariable);

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

  // Cambiar de fecha, profesional o servicios invalida la hora ya elegida: el
  // hueco de las 10:00 del martes no existe necesariamente el miercoles.
  const combinacionDeHora = `${date}|${selectedProfessional}|${totalDuration}`;
  // La hora que llega por la URL solo vale si el hueco sigue en la lista.
  const horaRestaurada =
    horaElegida.combinacion === "" && availableSlots.includes(inicial.hora)
      ? inicial.hora
      : "";
  const startTime =
    horaElegida.combinacion === combinacionDeHora
      ? horaElegida.startTime
      : horaRestaurada;
  const setStartTime = (valor: string) =>
    setHoraElegida({ combinacion: combinacionDeHora, startTime: valor });

  // Lo que el usuario elige se refleja en la URL con `replace`, sin apilar
  // historial: el que se apila es el paso, y lo hace `setStep`.
  const rutaDelPaso = `/marketplace/business/${slug}/book`;

  /** Cambia de paso apilando historial, que es lo que Atras deshace. */
  const setStep = (paso: number) => {
    const q = new URLSearchParams(searchParams.toString());
    if (paso > 1) q.set("paso", String(paso));
    else q.delete("paso");
    router.push(`${rutaDelPaso}?${q}`, { scroll: false });
  };

  useEffect(() => {
    // Hecha la reserva, el asistente deja de escribir en la URL.
    if (confirmation) return;

    const q = new URLSearchParams();
    if (step > 1) q.set("paso", String(step));
    selectedServices.forEach((id) => q.append("serviceId", id));
    if (selectedProfessional) q.set("professionalId", selectedProfessional);
    if (date) q.set("fecha", date);
    if (startTime) q.set("hora", startTime);
    const destino = q.toString() ? `${rutaDelPaso}?${q}` : rutaDelPaso;
    if (destino !== window.location.pathname + window.location.search) {
      router.replace(destino, { scroll: false });
    }
  }, [
    router,
    rutaDelPaso,
    step,
    selectedServices,
    selectedProfessional,
    date,
    startTime,
    confirmation,
  ]);

  useSeededForm(isAuthenticated ? user : null, (u) =>
    setGuest({
      name: u.name || "",
      email: u.email || "",
      phone: u.phone || "",
    })
  );

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
        professionalId: isAnyProfessional ? undefined : selectedProfessional,
        // Solo los ids: el precio y la duración los pone el catálogo.
        serviceIds: selectedServices,
        date,
        startTime,
        // Con quién contactar: de la cuenta del cliente, o del formulario.
        ...(reservaComoCliente && user
          ? {
              guestName: user.name,
              guestEmail: user.email || undefined,
              guestPhone: user.phone || undefined,
            }
          : {
              guestName: guest.name,
              guestEmail: guest.email || undefined,
              guestPhone: guest.phone || undefined,
            }),
      };

      // Con cuenta de cliente, la reserva va por la ruta autenticada.
      const result = reservaComoCliente
        ? await api.post<Confirmation>("/booking/appointments/mine", body)
        : await apiPublic.post<Confirmation>(
            "/booking/public/appointments",
            body
          );
      setConfirmation(result);
      // Se limpia la URL del formulario.
      router.replace(rutaDelPaso, { scroll: false });
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
        isAuthenticated={reservaComoCliente}
        contacto={
          reservaComoCliente && user
            ? { email: user.email, phone: user.phone }
            : { email: guest.email, phone: guest.phone }
        }
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

      {/* Tres estados: hecho con su check, actual marcado y pendiente en gris.
          Los hechos vuelven a su paso al pulsarlos. */}
      <ol className="mb-8 flex gap-2">
        {BOOKING_STEPS.map((s) => {
          const hecho = step > s.n;
          const actual = step === s.n;
          return (
            <li key={s.n} className="flex-1">
              <button
                type="button"
                onClick={() => hecho && setStep(s.n)}
                disabled={!hecho}
                aria-current={actual ? "step" : undefined}
                className={`focus-visible:ring-ring flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  hecho
                    ? "bg-primary/15 text-primary hover:bg-primary/25 cursor-pointer"
                    : actual
                      ? "bg-primary text-primary-foreground ring-primary/30 ring-2 ring-offset-2"
                      : "bg-muted text-muted-foreground cursor-default"
                }`}
              >
                {hecho ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <span>{s.n}.</span>
                )}
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <SelectServicesStep
          rutaDelNegocio={`/marketplace/business/${slug}`}
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
          diasAbiertos={diasAbiertos}
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
          precioPorConfirmar={precioPorConfirmar}
          user={reservaComoCliente && user ? user : null}
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
