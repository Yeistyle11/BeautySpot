"use client";
import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/utils";
import type { Service } from "../schemas";

export interface GuestDetails {
  name: string;
  email: string;
  phone: string;
}

interface GuestDetailsStepProps {
  selectedServices: Service[];
  date: string;
  startTime: string;
  totalDuration: number;
  totalAmount: number;
  /** Usuario con sesion iniciada; si existe, no se piden datos de invitado. */
  user: { name: string; email: string } | null;
  guest: GuestDetails;
  onGuestChange: (guest: GuestDetails) => void;
  error: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

/** Paso 4: resumen y datos de contacto antes de confirmar. */
export function GuestDetailsStep({
  selectedServices,
  date,
  startTime,
  totalDuration,
  totalAmount,
  user,
  guest,
  onGuestChange,
  error,
  submitting,
  onBack,
  onSubmit,
}: GuestDetailsStepProps) {
  const set = (patch: Partial<GuestDetails>) =>
    onGuestChange({ ...guest, ...patch });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Tus datos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted space-y-1 rounded-lg p-3 text-sm">
          <p>
            <span className="font-medium">Servicios:</span>{" "}
            {selectedServices.map((s) => s.name).join(", ")}
          </p>
          <p>
            <span className="font-medium">Fecha:</span> {date} a las {startTime}
          </p>
          <p>
            <span className="font-medium">Duracion:</span> {totalDuration} min
          </p>
          <p>
            <span className="font-medium">Total:</span>{" "}
            {formatCurrency(totalAmount)}
          </p>
        </div>

        {user ? (
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
            <Field label="Nombre completo *">
              <Input
                placeholder="Tu nombre"
                value={guest.name}
                onChange={(e) => set({ name: e.target.value })}
                required
              />
            </Field>
            <Field label="Email (opcional)">
              <Input
                type="email"
                placeholder="tu@email.com"
                value={guest.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field label="Telefono (opcional)">
              <Input
                type="tel"
                placeholder="+57 300 1234567"
                value={guest.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </Field>
          </>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Atras
          </Button>
          <Button
            disabled={(!user && !guest.name) || submitting}
            onClick={onSubmit}
            className="flex-1"
          >
            {submitting ? "Reservando..." : "Confirmar reserva"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
