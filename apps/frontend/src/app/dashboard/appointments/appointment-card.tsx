"use client";
import { Calendar, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import type { Appointment } from "./schemas";

interface AppointmentCardProps {
  appointment: Appointment;
  professionalName: string;
  canConfirm: boolean;
  canCancel: boolean;
  onConfirm: (id: string) => void;
  onComplete: (appointment: Appointment) => void;
  onCancel: (id: string) => void;
}

/** Fila de la agenda en vista lista, con las acciones segun el estado. */
export function AppointmentCard({
  appointment,
  professionalName,
  canConfirm,
  canCancel,
  onConfirm,
  onComplete,
  onCancel,
}: AppointmentCardProps) {
  const status = getAppointmentStatus(appointment.status);
  const serviceNames = appointment.appointmentServices
    .map((s) => s.serviceName)
    .join(", ");

  return (
    <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
              <Calendar className="text-primary h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{serviceNames}</p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(appointment.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(appointment.startTime)} -{" "}
                  {formatTime(appointment.endTime)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {professionalName}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold">
              {formatCurrency(parseFloat(appointment.totalAmount))}
            </span>
            {appointment.status === "PENDING" && canConfirm && (
              <Button size="sm" onClick={() => onConfirm(appointment.id)}>
                Confirmar
              </Button>
            )}
            {appointment.status === "CONFIRMED" && canConfirm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onComplete(appointment)}
              >
                Completar
              </Button>
            )}
            {appointment.status === "PENDING" && canCancel && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onCancel(appointment.id)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
