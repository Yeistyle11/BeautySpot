"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Scissors,
  Star,
  ArrowLeft,
  CheckCircle,
  Loader2,
  X,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AppointmentService {
  serviceName: string;
  price: string;
  duration: number;
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  totalAmount: string;
  professionalId: string;
  clientId: string;
  appointmentServices: AppointmentService[];
}

/* ------------------------------------------------------------------ */
/*  Star rating sub-component                                          */
/* ------------------------------------------------------------------ */

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            className={cn(
              "h-8 w-8 transition-colors",
              (hovered || value) >= star
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 fill-none"
            )}
          />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { businessId, user } = useAuthStore();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ---- Load appointment ---- */
  useEffect(() => {
    if (!id) return;
    api
      .get<Appointment>(`/booking/appointments/${id}`)
      .then(setAppointment)
      .catch((err) => setError(err.message || "Error al cargar la cita"))
      .finally(() => setLoading(false));
  }, [id]);

  /* ---- Validation ---- */
  const commentRequired = rating > 0 && rating < 4;
  const commentValid = commentRequired ? comment.trim().length > 0 : true;
  const isValid = rating > 0 && commentValid;

  /* ---- Photo URL helpers ---- */
  const handlePhotoChange = (index: number, value: string) => {
    const updated = [...photos];
    updated[index] = value;
    setPhotos(updated);
  };

  const addPhotoField = () => {
    if (photos.length < 3) {
      setPhotos([...photos, ""]);
    }
  };

  const removePhotoField = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  /* ---- Submit ---- */
  const handleSubmit = async () => {
    if (!appointment || !isValid) return;

    const effectiveBusinessId = businessId;
    if (!effectiveBusinessId) {
      setError(
        "No se pudo determinar el negocio. Vuelve a iniciar sesion e intentalo de nuevo."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    const cleanPhotos = photos.map((p) => p.trim()).filter((p) => p.length > 0);

    try {
      await api.post("/marketplace/reviews", {
        businessId: effectiveBusinessId,
        appointmentId: appointment.id,
        clientId: user?.id || appointment.clientId,
        professionalId: appointment.professionalId,
        rating,
        comment: comment.trim(),
        photos: cleanPhotos,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al publicar la resena";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando cita...</p>
      </div>
    );
  }

  if (!appointment && error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/client/appointments">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a mis citas
          </Button>
        </Link>
      </div>
    );
  }

  if (!appointment) return null;

  /* ---- Success state ---- */
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="mb-4 h-16 w-16 text-emerald-500" />
        <h2 className="text-xl font-bold">Resena publicada</h2>
        <p className="text-muted-foreground mt-2">
          Gracias por compartir tu experiencia
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={`/dashboard/client/appointments/${appointment.id}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a la cita
            </Button>
          </Link>
          <Link href="/dashboard/client/appointments">
            <Button>Mis citas</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/dashboard/client/appointments/${id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al detalle de la cita
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Dejar resena</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: appointment summary */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="h-4 w-4" />
                Resumen de la cita
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Services */}
              <div className="bg-muted/50 space-y-2 rounded-lg px-4 py-3">
                {appointment.appointmentServices.map((svc, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{svc.serviceName}</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(svc.price))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Date */}
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(appointment.date)}</span>
              </div>

              {/* Professional ID (fallback display) */}
              <div className="text-muted-foreground text-xs">
                Profesional: {appointment.professionalId}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: review form */}
        <div className="space-y-4 lg:col-span-2">
          {/* Rating */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Calificacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StarRating value={rating} onChange={setRating} />
              {rating > 0 && (
                <p className="text-muted-foreground text-sm">
                  {rating === 1 && "Malo"}
                  {rating === 2 && "Regular"}
                  {rating === 3 && "Bueno"}
                  {rating === 4 && "Muy bueno"}
                  {rating === 5 && "Excelente"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comment */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Comentario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder="Cuenta como fue tu experiencia..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
              {commentRequired && !commentValid && rating > 0 && (
                <p className="text-sm text-amber-600">
                  Para calificaciones menores a 4 estrellas, el comentario es
                  obligatorio
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {comment.length}/500 caracteres
              </p>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" />
                Fotos (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {photos.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="URL de la imagen (ej. https://...)"
                    value={url}
                    onChange={(e) => handlePhotoChange(idx, e.target.value)}
                  />
                  {photos.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhotoField(idx)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {photos.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPhotoField}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Agregar otra foto
                </Button>
              )}
              <p className="text-muted-foreground text-xs">
                Maximo 3 fotos. Pega la URL de cada imagen.
              </p>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link href={`/dashboard/client/appointments/${id}`}>
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  Publicar resena
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
