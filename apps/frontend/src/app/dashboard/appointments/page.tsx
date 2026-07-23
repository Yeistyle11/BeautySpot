"use client";
import { useState, useMemo, useDeferredValue } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Calendar, Plus, Search, X, List, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/utils";
import { useApi, revalidatePrefix } from "@/lib/swr";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { logger } from "@/lib/logger";
import { CalendarView } from "@/components/calendar-view";
import { AppointmentForm } from "./appointment-form";
import { AppointmentCard } from "./appointment-card";
import {
  CompleteAppointmentDialog,
  emptyPaymentDraft,
  type PaymentDraft,
} from "./complete-appointment-dialog";
import {
  appointmentSchema,
  APPOINTMENTS_KEY,
  clientSchema,
  CLIENTS_KEY,
  emptyForm,
  professionalSchema,
  PROFESSIONALS_KEY,
  serviceSchema,
  SERVICES_KEY,
  type Appointment,
  type AppointmentForm as FormValues,
  type Client,
  type Professional,
  type Service,
} from "./schemas";

export default function AppointmentsPage() {
  const { role } = useAuthStore();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // El calendario pinta una semana entera, asi que pide el maximo que admite
  // el backend (100) en vez de paginar; la lista si pagina de 20 en 20.
  const {
    items: appointments,
    meta,
    setPage,
    isLoading: loading,
  } = usePaginatedList<Appointment>({
    basePath: APPOINTMENTS_KEY,
    itemSchema: appointmentSchema,
    limit: viewMode === "calendar" ? 100 : undefined,
  });

  // Los catalogos solo hacen falta con el formulario abierto.
  const { data: professionals } = useApi<Professional[]>(
    showForm ? PROFESSIONALS_KEY : null,
    undefined,
    z.array(professionalSchema)
  );
  const { data: services } = useApi<Service[]>(
    showForm ? SERVICES_KEY : null,
    undefined,
    z.array(serviceSchema)
  );
  const { data: clients } = useApi<Client[]>(
    showForm ? CLIENTS_KEY : null,
    undefined,
    z.array(clientSchema)
  );

  const [form, setForm] = useState<FormValues>(emptyForm);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [completingAppt, setCompletingAppt] = useState<Appointment | null>(
    null
  );
  const [payment, setPayment] = useState<PaymentDraft>(emptyPaymentDraft);
  const [completingAction, setCompletingAction] = useState(false);

  const professionalMap = useMemo(() => {
    const map: Record<string, string> = {};
    (professionals ?? []).forEach((p) => {
      map[p.id] = p.name || "Sin nombre";
    });
    return map;
  }, [professionals]);

  // Filtro local sobre la pagina cargada: el endpoint de citas todavia no
  // acepta busqueda de texto, asi que la UI lo dice en vez de aparentar que
  // busca en todo el historial.
  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    if (!q) return appointments;
    return appointments.filter(
      (a) =>
        a.appointmentServices.some((s) =>
          s.serviceName.toLowerCase().includes(q)
        ) || a.id.includes(deferredSearch)
    );
  }, [appointments, deferredSearch]);

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(
        `/booking/appointments/${id}/${action}`,
        action === "cancel" ? { reason: "Cancelado por usuario" } : {}
      );
      await revalidatePrefix(APPOINTMENTS_KEY);
    } catch (err) {
      logger.error(err);
    }
  };

  const openCompleteDialog = (appt: Appointment) => {
    setCompletingAppt(appt);
    setPayment(emptyPaymentDraft);
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
          method: payment.method,
          reference: payment.reference || undefined,
          notes: payment.notes || undefined,
        });
      }

      await revalidatePrefix(APPOINTMENTS_KEY);
      await revalidatePrefix("/payment/payments");
      setCompletingAppt(null);
    } catch (err) {
      logger.error(err);
    } finally {
      setCompletingAction(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // El backend guarda nombre y precio junto a la cita, para que el
      // historico no cambie si luego se edita el servicio en el catalogo.
      const serviceData = selectedServices.flatMap((id) => {
        const svc = (services ?? []).find((s) => s.id === id);
        return svc
          ? [
              {
                id: svc.id,
                name: svc.name,
                price: svc.price,
                duration: svc.duration,
              },
            ]
          : [];
      });
      await api.post("/booking/appointments", {
        ...form,
        serviceIds: serviceData,
      });
      setShowForm(false);
      setForm(emptyForm);
      setSelectedServices([]);
      await revalidatePrefix(APPOINTMENTS_KEY);
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">Gestiona tus citas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border">
            <button
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <List className="h-4 w-4" /> Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              aria-pressed={viewMode === "calendar"}
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
        <AppointmentForm
          form={form}
          onChange={setForm}
          onSubmit={handleCreate}
          professionals={professionals ?? []}
          clients={clients ?? []}
          services={services ?? []}
          selectedServices={selectedServices}
          onToggleService={toggleService}
          submitting={submitting}
          error={error}
        />
      )}

      {viewMode === "list" && (
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              id="appointment-search"
              placeholder="Filtrar por servicio..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-describedby="appointment-search-hint"
            />
          </div>
          <p
            id="appointment-search-hint"
            className="text-muted-foreground mt-1.5 text-xs"
          >
            Filtra las citas de esta pagina.
          </p>
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
                appointments={appointments}
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
            filtered.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                professionalName={
                  professionalMap[appt.professionalId] ||
                  appt.professionalId.slice(0, 8)
                }
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
                onConfirm={(id) => handleAction(id, "confirm")}
                onComplete={openCompleteDialog}
                onCancel={(id) => handleAction(id, "cancel")}
              />
            ))
          )}
          <Pagination meta={meta} onPageChange={setPage} itemLabel="citas" />
        </div>
      )}

      <CompleteAppointmentDialog
        open={!!completingAppt}
        onClose={() => setCompletingAppt(null)}
        appointment={completingAppt}
        payment={payment}
        onPaymentChange={setPayment}
        onComplete={handleCompleteWithPayment}
        pending={completingAction}
      />
    </div>
  );
}
