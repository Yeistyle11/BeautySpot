"use client";

// Pantalla de confirmacion mostrada tras completar una reserva.
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { BookingConfirmation as Confirmation } from "./schemas";

interface BookingConfirmationProps {
  confirmation: Confirmation;
  businessName: string;
  slug: string;
  date: string;
  isAuthenticated: boolean;
}

/** Pantalla final tras reservar, con el resumen de lo agendado. */
export function BookingConfirmation({
  confirmation,
  businessName,
  slug,
  date,
  isAuthenticated,
}: BookingConfirmationProps) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="bg-success-soft text-success-soft-foreground mx-auto flex h-20 w-20 items-center justify-center rounded-full">
        <CheckCircle className="h-10 w-10" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Tu cita ha sido reservada</h1>
      <p className="text-muted-foreground mt-2">
        Recibiras un correo de confirmacion
      </p>
      <Card className="mt-6 border-0 text-left shadow-sm">
        <CardContent className="space-y-2 p-6">
          <p className="text-sm">
            <span className="font-medium">Negocio:</span> {businessName}
          </p>
          <p className="text-sm">
            <span className="font-medium">Fecha:</span> {date}
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
        {/* Con sesion iniciada la cita queda en "Mis citas"; como invitado no
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
