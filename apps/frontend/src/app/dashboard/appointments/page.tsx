"use client";
import { useState, useMemo } from "react";
import { mutate } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  Calendar,
  Plus,
  Clock,
  User,
  Search,
  X,
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle,
  List,
  CalendarDays,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getErrorMessage,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { useApi } from "@/lib/swr";
import { CalendarView } from "@/components/calendar-view";

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
  appointmentServices: {
    serviceName: string;
    price: string;
    duration: number;
  }[];
}

interface Professional {
  id: string;
  name: string | null;
}
interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}
interface Client {
  id: string;
  name: string;
}

const paymentMethodOptions = [
  { value: "CASH", label: "Efectivo", icon: <Banknote className="h-5 w-5" /> },
  {
    value: "CARD",
    label: "Datáfono",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    value: "TRANSFER",
    label: "Transferencia",
    icon: <Smartphone className="h-5 w-5" />,
  },
];

export default function AppointmentsPage() {
  const { role } = useAuthStore();
  const APPOINTMENTS_KEY = "/booking/appointments";
  const PROFESSIONALS_KEY = "/core/professionals";
  const SERVICES_KEY = "/core/services";
  const CLIENTS_KEY = "/core/clients";

  const { data: appointments, isLoading: loading } =
    useApi<Appointment[]>(APPOINTMENTS_KEY);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: professionals } = useApi<Professional[]>(
    showForm ? PROFESSIONALS_KEY : null
  );
  const { data: services } = useApi<Service[]>(showForm ? SERVICES_KEY : null);
  const { data: clients } = useApi<Client[]>(showForm ? CLIENTS_KEY : null);

  const [form, setForm] = useState({
    professionalId: "",
    clientId: "",
    date: "",
    startTime: "",
    notes: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [completeDialog, setCompleteDialog] = useState(false);
  const [completingAppt, setCompletingAppt] = useState<Appointment | null>(
    null
  );
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [completingAction, setCompletingAction] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const professionalMap = useMemo(() => {
    const map: Record<string, string> = {};
    (professionals ?? []).forEach((p) => {
      map[p.id] = p.name || "Sin nombre";
    });
    return map;
  }, [professionals]);

  const filtered = (appointments ?? []).filter(
    (a) =>
      a.appointmentServices.some((s) =>
        s.serviceName.toLowerCase().includes(search.toLowerCase())
      ) || a.id.includes(search)
  );

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(
        `/booking/appointments/${id}/${action}`,
        action === "cancel" ? { reason: "Cancelado por usuario" } : {}
      );
      await mutate(APPOINTMENTS_KEY);
    } catch (err) {
      console.error(err);
    }
  };

  const openCompleteDialog = (appt: Appointment) => {
    setCompletingAppt(appt);
    setPaymentMethod("CASH");
    setPaymentRef("");
    setPaymentNotes("");
    setCompleteDialog(true);
  };

  const handleCompleteWithPayment = async (registerPayment: boolean) => {
    if (!completingAppt) return;
    setCompletingAction(true);
    try {
      await api.post(`/booking/appointments/${completingAppt.id}/complete`, {});

      if (registerPayment) {
        await api.post("/payment/payments", {
          appointmentId: completingAppt.id,
          clientId: completingAppt.clientId,
          amount: parseFloat(completingAppt.totalAmount),
          method: paymentMethod,
          reference: paymentRef || undefined,
          notes: paymentNotes || undefined,
        });
      }

      await mutate(APPOINTMENTS_KEY);
      await mutate("/payment/payments");
      setCompleteDialog(false);
      setCompletingAppt(null);
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingAction(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const serviceData = selectedServices.map((sid) => {
        const svc = (services ?? []).find((s) => s.id === sid)!;
        return {
          id: svc.id,
          name: svc.name,
          price: svc.price,
          duration: svc.duration,
        };
      });
      await api.post("/booking/appointments", {
        ...form,
        serviceIds: serviceData,
      });
      setShowForm(false);
      setForm({
        professionalId: "",
        clientId: "",
        date: "",
        startTime: "",
        notes: "",
      });
      setSelectedServices([]);
      await mutate(APPOINTMENTS_KEY);
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear la cita"));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">Gestiona tus citas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <List className="h-4 w-4" /> Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "calendar" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <CalendarDays className="h-4 w-4" /> Calendario
            </button>
          </div>
          {canDo(role, "appointments_create") && (
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? (
                <X className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {showForm ? "Cancelar" : "Nueva cita"}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Nueva cita</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="space-y-2">
                <Label>Profesional</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.professionalId}
                  onChange={(e) =>
                    setForm({ ...form, professionalId: e.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar...</option>
                  {(professionals ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "Sin nombre"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.clientId}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar...</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Hora inicio</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label>Servicios</Label>
                <div className="flex flex-wrap gap-2">
                  {(services ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedServices.includes(s.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:border-primary"
                      }`}
                    >
                      {s.name} — {formatCurrency(s.price)}
                    </button>
                  ))}
                  {(services ?? []).length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      No hay servicios disponibles
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label>Notas (opcional)</Label>
                <Input
                  placeholder="Notas sobre la cita..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              {error && (
                <p className="text-destructive text-center text-sm sm:col-span-2 lg:col-span-3">
                  {error}
                </p>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <Button
                  type="submit"
                  disabled={submitting || selectedServices.length === 0}
                >
                  {submitting ? "Creando..." : "Crear cita"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {viewMode === "list" && (
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por servicio..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {viewMode === "calendar" ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">
                Cargando...
              </p>
            ) : (
              <CalendarView
                appointments={appointments ?? []}
                onComplete={openCompleteDialog}
                onConfirm={(id) => handleAction(id, "confirm")}
                onCancel={(id) => handleAction(id, "cancel")}
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="text-muted-foreground p-8 text-center">
                Cargando citas...
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="text-muted-foreground p-8 text-center">
                <Calendar className="mx-auto h-12 w-12 opacity-20" />
                <p className="mt-2">No hay citas</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((appt) => {
              const status = getAppointmentStatus(appt.status);
              return (
                <Card
                  key={appt.id}
                  className="border-0 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
                          <Calendar className="text-primary h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {appt.appointmentServices
                                .map((s) => s.serviceName)
                                .join(", ")}
                            </p>
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(appt.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(appt.startTime)} -{" "}
                              {formatTime(appt.endTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {professionalMap[appt.professionalId] ||
                                appt.professionalId.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(appt.totalAmount))}
                        </span>
                        {appt.status === "PENDING" &&
                          canDo(role, "appointments_confirm") && (
                            <Button
                              size="sm"
                              onClick={() => handleAction(appt.id, "confirm")}
                            >
                              Confirmar
                            </Button>
                          )}
                        {appt.status === "CONFIRMED" &&
                          canDo(role, "appointments_confirm") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCompleteDialog(appt)}
                            >
                              Completar
                            </Button>
                          )}
                        {appt.status === "PENDING" &&
                          canDo(role, "appointments_cancel") && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAction(appt.id, "cancel")}
                            >
                              Cancelar
                            </Button>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Dialog
        open={completeDialog}
        onClose={() => setCompleteDialog(false)}
        title="Completar cita"
        wide
      >
        {completingAppt && (
          <div className="space-y-6">
            <div className="bg-muted/50 space-y-3 rounded-lg p-4">
              <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
                Resumen de la cita
              </h3>
              <div className="space-y-2">
                {completingAppt.appointmentServices.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {s.serviceName} ({s.duration} min)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(s.price))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>
                    {formatCurrency(parseFloat(completingAppt.totalAmount))}
                  </span>
                </div>
              </div>
              <div className="text-muted-foreground flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(completingAppt.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(completingAppt.startTime)} -{" "}
                  {formatTime(completingAppt.endTime)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Metodo de pago</Label>
              <RadioGroup
                options={paymentMethodOptions}
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
            </div>

            {paymentMethod === "TRANSFER" && (
              <div className="space-y-2">
                <Label>Referencia de la transferencia</Label>
                <Input
                  placeholder="Ej: #123456789"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                placeholder="Notas sobre el pago..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleCompleteWithPayment(true)}
                disabled={completingAction}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {completingAction
                  ? "Procesando..."
                  : "Completar y registrar pago"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCompleteWithPayment(false)}
                disabled={completingAction}
              >
                {completingAction ? "Procesando..." : "Completar sin pago"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
