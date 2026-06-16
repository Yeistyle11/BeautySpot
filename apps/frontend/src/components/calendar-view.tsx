"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/utils";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: string;
  professionalId: string;
  clientId: string;
  notes: string | null;
  appointmentServices: { serviceName: string; price: string; duration: number }[];
}

interface CalendarViewProps {
  appointments: Appointment[];
  onComplete: (appt: Appointment) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  canConfirm: boolean;
  canCancel: boolean;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-200 border-yellow-400 text-yellow-900",
  CONFIRMED: "bg-blue-200 border-blue-400 text-blue-900",
  IN_PROGRESS: "bg-purple-200 border-purple-400 text-purple-900",
  COMPLETED: "bg-green-200 border-green-400 text-green-900",
  CANCELLED: "bg-red-200 border-red-400 text-red-900",
  NO_SHOW: "bg-gray-200 border-gray-400 text-gray-700",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistio",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00
const DAYS_ES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function getWeekDates(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function CalendarView({ appointments, onComplete, onConfirm, onCancel, canConfirm, canCancel }: CalendarViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  const referenceDate = new Date();
  referenceDate.setDate(referenceDate.getDate() + weekOffset * 7);

  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate.getTime()]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  const prevWeek = () => setWeekOffset((p) => p - 1);
  const nextWeek = () => setWeekOffset((p) => p + 1);
  const thisWeek = () => setWeekOffset(0);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = `${weekDates[0].toLocaleDateString("es-CO", { day: "numeric", month: "short" })} - ${weekDates[6].toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          {!isCurrentWeek && <Button variant="ghost" size="sm" onClick={thisWeek}>Hoy</Button>}
          <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-medium ml-2">{weekLabel}</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div className="p-2 text-xs text-muted-foreground text-center">Hora</div>
            {weekDates.map((d, i) => {
              const isToday = dateKey(d) === dateKey(new Date());
              return (
                <div key={i} className={`p-2 text-center ${isToday ? "bg-primary/5" : ""}`}>
                  <p className="text-xs text-muted-foreground">{DAYS_ES[i]}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Time rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50">
              <div className="p-1 text-xs text-muted-foreground text-center">
                {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "pm" : "am"}
              </div>
              {weekDates.map((d, dayIdx) => {
                const key = dateKey(d);
                const dayAppts = appointmentsByDate[key] || [];
                const hourAppts = dayAppts.filter((a) => {
                  const startHour = parseInt(a.startTime.split(":")[0]);
                  return startHour === hour;
                });

                return (
                  <div key={dayIdx} className="min-h-[48px] p-0.5 relative">
                    {hourAppts.map((appt) => {
                      const colorClass = statusColors[appt.status] || statusColors.PENDING;
                      return (
                        <button
                          key={appt.id}
                          onClick={() => setSelectedAppt(selectedAppt?.id === appt.id ? null : appt)}
                          className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] border cursor-pointer ${colorClass} ${selectedAppt?.id === appt.id ? "ring-2 ring-primary" : ""}`}
                        >
                          <p className="font-medium truncate">{appt.appointmentServices[0]?.serviceName || "Cita"}</p>
                          <p className="opacity-70">{formatTime(appt.startTime)}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected appointment detail */}
      {selectedAppt && (
        <div className="mt-4 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">{selectedAppt.appointmentServices.map((s) => s.serviceName).join(", ")}</h4>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{formatTime(selectedAppt.startTime)} - {formatTime(selectedAppt.endTime)}</span>
                <span className="font-medium">{formatCurrency(parseFloat(selectedAppt.totalAmount))}</span>
              </div>
              <Badge className="mt-2" variant={selectedAppt.status === "CANCELLED" ? "destructive" : selectedAppt.status === "COMPLETED" ? "secondary" : "default"}>
                {statusLabels[selectedAppt.status] || selectedAppt.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              {selectedAppt.status === "PENDING" && canConfirm && (
                <Button size="sm" onClick={() => onConfirm(selectedAppt.id)}>Confirmar</Button>
              )}
              {selectedAppt.status === "CONFIRMED" && canConfirm && (
                <Button size="sm" variant="outline" onClick={() => onComplete(selectedAppt)}>Completar</Button>
              )}
              {selectedAppt.status === "PENDING" && canCancel && (
                <Button size="sm" variant="destructive" onClick={() => onCancel(selectedAppt.id)}>Cancelar</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
