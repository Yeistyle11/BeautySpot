"use client";

// Pantalla de confirmacion mostrada tras completar una reserva.
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingConfirmation as Confirmation } from "./schemas";

interface BookingConfirmationProps {
  confirmation: Confirmation;
  businessName: string;
  slug: string;
  date: string;
  isAuthenticated: boolean;
  /** Contacto con el que se reservo, del que depende lo que se puede prometer. */
  contacto: { email?: string | null; phone?: string | null };
}

/**
 * Lo que el negocio podra hacer con lo que el cliente dejo. Prometer un correo
 * a quien no dio ninguno deja esperando una confirmacion que no va a llegar.
 */
function avisoDeContacto(contacto: {
  email?: string | null;
  phone?: string | null;
}): string {
  if (contacto.email) {
    return `Recibirás un correo de confirmación en ${contacto.email}`;
  }
  if (contacto.phone) return "El negocio te confirmará la cita por teléfono";
  return "Anota la fecha y la hora: no dejaste ningún dato de contacto con el que avisarte";
}

/** Pantalla final tras reservar, con el resumen de lo agendado. */
export function BookingConfirmation({
  confirmation,
  businessName,
  slug,
  date,
  isAuthenticated,
  contacto,
}: BookingConfirmationProps) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="bg-success-soft text-success-soft-foreground mx-auto flex h-20 w-20 items-center justify-center rounded-full">
        <CheckCircle className="h-10 w-10" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Tu cita ha sido reservada</h1>
      <p className="text-muted-foreground mt-2">{avisoDeContacto(contacto)}</p>
      <Card className="mt-6 border-0 text-left shadow-sm">
        <CardContent className="space-y-2 p-6">
          <p className="text-sm">
            <span className="font-medium">Negocio:</span> {businessName}
          </p>
          <p className="text-sm">
            <span className="font-medium">Fecha:</span> {formatDate(date)}
          </p>
          <p className="text-sm">
            <span className="font-medium">Hora:</span> {confirmation.startTime}{" "}
            - {confirmation.endTime}
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
        {/* Con sesión iniciada la cita queda en "Mis citas"; como invitado no
            hay panel al que enviar al usuario. */}
        <Link
          href={
            isAuthenticated ? "/dashboard/client/appointments" : "/marketplace"
          }
        >
          <Button variant="outline">
            {isAuthenticated ? "Mis citas" : "Volver al inicio"}
          </Button>
        </Link>
        <Link href={`/marketplace/business/${slug}`}>
          <Button>Ver negocio</Button>
        </Link>
      </div>
    </div>
  );
}
