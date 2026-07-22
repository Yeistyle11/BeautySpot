"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { mutate } from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Scissors,
  Clock,
  ArrowLeft,
  CheckCircle,
  User,
  Loader2,
} from "lucide-react";
import { apiPublic, api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { useApiPublic } from "@/lib/swr";

interface Profile {
  id: string;
  businessId: string;
  name: string;
  slug: string;
}
interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}
interface Professional {
  id: string;
  professionalId?: string;
  name: string;
  photo: string | null;
  specialties: string[];
}

interface BookingConfirmation {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  totalAmount?: number | string;
  services?: string[];
  [key: string]: unknown;
}

function PublicBookingPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const preselectedProfId = searchParams.get("professionalId") || "";

  const { user, hydrated } = useAuthStore();
  const isAuthenticated = hydrated && !!user;

  const { data: profile, isLoading: loading } = useApiPublic<Profile>(
    `/marketplace/profiles/${slug}`
  );
  const servicesKey = profile?.businessId
    ? `/core/public/businesses/${profile.businessId}/services`
    : null;
  const profKey = profile?.businessId
    ? `/marketplace/professional-profiles/business/${profile.businessId}`
    : null;
  const { data: rawServices } = useApiPublic<Service[]>(servicesKey);
  const { data: rawProfessionals } = useApiPublic<Professional[]>(profKey);

  const services = (rawServices ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    price: Number(s.price),
    duration: s.duration,
  }));
  const professionals = (rawProfessionals ?? []).map((p) => ({
    id: p.professionalId || p.id,
    name: p.name,
    photo: p.photo,
    specialties: p.specialties || [],
  }));

  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] =
    useState(preselectedProfId);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(
    null
  );
  const [error, setError] = useState("");

  const selectedServiceData = services.filter((s) =>
    selectedServices.includes(s.id)
  );
  const totalDuration = selectedServiceData.reduce(
    (sum, s) => sum + s.duration,
    0
  );
  const totalAmount = selectedServiceData.reduce((sum, s) => sum + s.price, 0);

  const slotsKey =
    date &&
    selectedProfessional &&
    selectedServiceData.length > 0 &&
    selectedProfessional !== "any"
      ? `/booking/appointments/availability?professionalId=${selectedProfessional}&date=${date}&duration=${totalDuration}`
      : null;
  const { data: rawSlots, isLoading: slotsLoading } =
    useApiPublic<string[]>(slotsKey);
  const availableSlots =
    selectedProfessional === "any" && date
      ? generateFallbackSlots()
      : Array.isArray(rawSlots)
        ? rawSlots
        : [];

  useEffect(() => {
    setStartTime("");
  }, [availableSlots]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setGuestName(user.name || "");
      setGuestEmail(user.email || "");
      setGuestPhone(user.phone || "");
    }
  }, [isAuthenticated, user]);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        businessId: profile!.businessId,
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

      if (isAuthenticated && user) {
        body.clientId = user.id;
      } else {
        body.guestName = guestName;
        body.guestEmail = guestEmail || undefined;
        body.guestPhone = guestPhone || undefined;
      }

      const result = await (isAuthenticated
        ? api.post<BookingConfirmation>("/booking/appointments", body)
        : apiPublic.post<BookingConfirmation>(
            "/booking/public/appointments",
            body
          ));
      setConfirmation(result);
      setStep(5);
      await mutate("/booking/appointments");
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear la reserva"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  if (!profile)
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

  if (confirmation) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Tu cita ha sido reservada</h1>
        <p className="text-muted-foreground mt-2">
          Recibiras un correo de confirmacion
        </p>
        <Card className="mt-6 border-0 text-left shadow-sm">
          <CardContent className="space-y-2 p-6">
            <p className="text-sm">
              <span className="font-medium">Negocio:</span> {profile.name}
            </p>
            <p className="text-sm">
              <span className="font-medium">Fecha:</span> {date}
            </p>
            <p className="text-sm">
              <span className="font-medium">Hora:</span>{" "}
              {confirmation.startTime} - {confirmation.endTime}
            </p>
            <p className="text-sm">
              <span className="font-medium">Servicios:</span>{" "}
              {confirmation.services?.join(", ")}
            </p>
            <p className="text-sm">
              <span className="font-medium">Total:</span>{" "}
              {formatCurrency(Number(confirmation.totalAmount ?? 0))}
            </p>
          </CardContent>
        </Card>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard/client/appointments">
                <Button variant="outline">Mis citas</Button>
              </Link>
              <Link href={`/marketplace/business/${slug}`}>
                <Button>Ver negocio</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/marketplace">
                <Button variant="outline">Volver al inicio</Button>
              </Link>
              <Link href={`/marketplace/business/${slug}`}>
                <Button>Ver negocio</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const steps = [
    { n: 1, label: "Servicios" },
    { n: 2, label: "Profesional" },
    { n: 3, label: "Horario" },
    { n: 4, label: "Tus datos" },
  ];

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

      <div className="mb-8 flex gap-2">
        {steps.map((s) => (
          <div
            key={s.n}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors ${
              step >= s.n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s.n}. {s.label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Selecciona los servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                    selectedServices.includes(s.id)
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {s.duration} min
                    </p>
                  </div>
                  <span className="text-primary font-semibold">
                    {formatCurrency(s.price)}
                  </span>
                </button>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="bg-muted mt-4 rounded-lg p-3 text-sm">
                <p>
                  Total:{" "}
                  <span className="font-semibold">
                    {formatCurrency(totalAmount)}
                  </span>{" "}
                  · Duracion: {totalDuration} min
                </p>
              </div>
            )}
            <Button
              className="mt-4 w-full"
              disabled={selectedServices.length === 0}
              onClick={() => {
                if (selectedProfessional && selectedServices.length > 0) {
                  setStep(3);
                } else {
                  setStep(2);
                }
              }}
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Selecciona el profesional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {professionals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProfessional(p.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    selectedProfessional === p.id
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                      {(p.name || "?").charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{p.name || "Profesional"}</p>
                    {p.specialties && p.specialties.length > 0 && (
                      <p className="text-muted-foreground text-sm">
                        {p.specialties.join(", ")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedProfessional("any")}
                className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                  selectedProfessional === "any"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <div className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                  <Scissors className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Cualquier profesional</p>
                  <p className="text-muted-foreground text-sm">
                    Se asignara el primero disponible
                  </p>
                </div>
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Atras
              </Button>
              <Button
                disabled={!selectedProfessional}
                onClick={() => setStep(3)}
                className="flex-1"
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Selecciona fecha y hora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            {date && selectedProfessional === "any" && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <p>
                  Selecciona un profesional especifico para ver disponibilidad
                  exacta. Se mostrara un rango general de horarios.
                </p>
              </div>
            )}
            {date && slotsLoading && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Consultando disponibilidad...</span>
              </div>
            )}
            {date && !slotsLoading && (
              <div className="space-y-2">
                <Label>Hora disponible</Label>
                {availableSlots.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    No hay horarios disponibles para esta fecha
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setStartTime(t)}
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                          startTime === t
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Atras
              </Button>
              <Button
                disabled={!date || !startTime}
                onClick={() => setStep(4)}
                className="flex-1"
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Tus datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted space-y-1 rounded-lg p-3 text-sm">
              <p>
                <span className="font-medium">Servicios:</span>{" "}
                {selectedServiceData.map((s) => s.name).join(", ")}
              </p>
              <p>
                <span className="font-medium">Fecha:</span> {date} a las{" "}
                {startTime}
              </p>
              <p>
                <span className="font-medium">Duracion:</span> {totalDuration}{" "}
                min
              </p>
              <p>
                <span className="font-medium">Total:</span>{" "}
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {isAuthenticated && user ? (
              <div className="bg-primary/5 flex items-center gap-3 rounded-lg border p-4">
                <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Reservando como {user.name}</p>
                  <p className="text-muted-foreground text-sm">{user.email}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Nombre completo *</Label>
                  <Input
                    placeholder="Tu nombre"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email (opcional)</Label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefono (opcional)</Label>
                  <Input
                    type="tel"
                    placeholder="+57 300 1234567"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>
              </>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="flex-1"
              >
                Atras
              </Button>
              <Button
                disabled={(!isAuthenticated && !guestName) || submitting}
                onClick={handleSubmit}
                className="flex-1"
              >
                {submitting ? "Reservando..." : "Confirmar reserva"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function generateFallbackSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 18; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 18) {
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return slots;
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
