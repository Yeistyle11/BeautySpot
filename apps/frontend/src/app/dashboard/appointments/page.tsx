"use client";

// Pagina de agenda: lista y calendario de citas, con busqueda, paginacion y acciones de crear/confirmar/cancelar/completar.
import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Calendar,
  Plus,
  Search,
  X,
  List,
  CalendarDays,
  Columns3,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { getErrorMessage, toLocalDateKey } from "@/lib/utils";
import { useApi, paginatedSchema, revalidatePrefix } from "@/lib/swr";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
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

// La agenda abre en modo lista, asi que la rejilla semanal solo se descarga si
// el usuario cambia de vista.
const CalendarView = dynamic(
  () => import("@/components/calendar-view").then((m) => m.CalendarView),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground">Cargando...</p>,
  }
);

const DayView = dynamic(
  () => import("@/components/day-view").then((m) => m.DayView),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground">Cargando...</p>,
  }
);

export default function AppointmentsPage() {
  const toast = useToast();
  const { role } = useAuthStore();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "day" | "calendar">("list");
  const [dia, setDia] = useState(() => toLocalDateKey(new Date()));

  // El calendario pinta una semana entera, asi que pide el maximo que admite
  // el backend (100) en vez de paginar; la lista si pagina de 20 en 20.
  const {
    items: appointments,
    meta,
    setPage,
    isLoading: loading,
    error: loadError,
    mutate: recargar,
  } = usePaginatedList<Appointment>({
    basePath: APPOINTMENTS_KEY,
    itemSchema: appointmentSchema,
    // La vista día acota al servidor y no necesita traerse la semana entera.
    params: viewMode === "day" ? { date: dia } : undefined,
    limit: viewMode === "list" ? undefined : 100,
    // El calendario pinta la semana entera: filtrarla por texto la dejaria a
    // huecos, asi que la busqueda solo aplica a la lista.
    search: viewMode === "list" ? search : "",
  });

  // Los profesionales se cargan siempre: ademas del formulario, la lista de citas
  // los necesita para mostrar el nombre en vez del identificador.
  const { data: professionals } = useApi<Professional[]>(
    PROFESSIONALS_KEY,
    undefined,
    z.array(professionalSchema)
  );
  // Servicios y clientes solo hacen falta con el formulario abierto.
  const { data: services } = useApi<Service[]>(
    showForm ? SERVICES_KEY : null,
    undefined,
    z.array(serviceSchema)
  );
  const { data: clientsPage } = useApi(
    showForm ? CLIENTS_KEY : null,
    undefined,
    paginatedSchema(clientSchema)
  );
  const clients: Client[] = clientsPage?.data ?? [];

  const [form, setForm] = useState<FormValues>(emptyForm);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [completingAppt, setCompletingAppt] = useState<Appointment | null>(
    null
  );
  const [payment, setPayment] = useState<PaymentDraft>(emptyPaymentDraft);
  const [completingAction, setCompletingAction] = useState(false);

  // Las citas solo traen el id del cliente —vive en otro servicio—, asi que el
  // nombre se cruza contra la lista que la pagina carga para el formulario.
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [clients]);

  const professionalMap = useMemo(() => {
    const map: Record<string, string> = {};
    (professionals ?? []).forEach((p) => {
      map[p.id] = p.name || "Sin nombre";
    });
    return map;
  }, [professionals]);

  // La busqueda la resuelve el backend sobre todo el historial, por cliente y
  // por servicio.
  const filtered = appointments;

  // Los tres handlers que reciben las tarjetas van memoizados: sin identidad
  // estable, AppointmentCard se re-renderizaria entera con cada pulsacion del
  // buscador.
  const handleAction = useCallback(
    async (id: string, action: string) => {
      try {
        await api.post(
          `/booking/appointments/${id}/${action}`,
          action === "cancel" ? { reason: "Cancelado por usuario" } : {}
        );
        await revalidatePrefix(APPOINTMENTS_KEY);
      } catch (err) {
        logger.error(err);
        toast.error(mensajeDeError(err));
      }
    },
    [toast]
  );

  const handleConfirm = useCallback(
    (id: string) => handleAction(id, "confirm"),
    [handleAction]
  );
  const handleCancel = useCallback(
    (id: string) => handleAction(id, "cancel"),
    [handleAction]
  );
  const handleNoShow = useCallback(
    (id: string) => handleAction(id, "no-show"),
    [handleAction]
  );

  const openCompleteDialog = useCallback((appt: Appointment) => {
    setCompletingAppt(appt);
    setPayment(emptyPaymentDraft);
  }, []);

  const handleCompleteWithPayment = async (registerPayment: boolean) => {
    if (!completingAppt) return;
    setCompletingAction(true);
    try {
      // El efectivo necesita una caja abierta donde anotarse. Se comprueba
      // antes de completar para no dejar la cita cerrada y el cobro sin hacer.
      if (registerPayment && payment.method === "CASH") {
        const caja = await api.get<{ id: string } | null>(
          "/payment/cash-register/active"
        );
        if (!caja) {
          toast.error(
            "No hay una caja abierta: abre la caja antes de cobrar en efectivo"
          );
          return;
        }
      }

      await api.post(`/booking/appointments/${completingAppt.id}/complete`, {});

      if (registerPayment) {
        await api.post("/payment/payments", {
          appointmentId: completingAppt.id,
          clientId: completingAppt.clientId,
          amount: completingAppt.totalAmount,
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
      toast.error(mensajeDeError(err));
    } finally {
      setCompletingAction(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Solo los ids: el nombre, el precio y la duracion los resuelve el
      // backend contra el catalogo y los congela junto a la cita, para que el
      // historico no cambie si luego se edita el servicio.
      await api.post("/booking/appointments", {
        ...form,
        serviceIds: selectedServices,
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
              onClick={() => setViewMode("day")}
              aria-pressed={viewMode === "day"}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "day" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <Columns3 className="h-4 w-4" /> Día
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              aria-pressed={viewMode === "calendar"}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${viewMode === "calendar" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <CalendarDays className="h-4 w-4" /> Semana
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
              placeholder="Buscar por cliente o servicio..."
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
            Busca en todo el historial por nombre, correo o teléfono del cliente
            y por servicio.
          </p>
        </div>
      )}

      {viewMode === "day" ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">
                Cargando...
              </p>
            ) : (
              <DayView
                appointments={appointments}
                professionals={professionals ?? []}
                date={dia}
                onDateChange={setDia}
                onComplete={openCompleteDialog}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                onNoShow={handleNoShow}
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
                clientNames={clientMap}
              />
            )}
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
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
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                onNoShow={handleNoShow}
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
                clientNames={clientMap}
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
          ) : loadError ? (
            <ErrorDeCarga
              error={loadError}
              recurso="las citas"
              onReintentar={() => recargar()}
            />
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
                clientName={clientMap[appt.clientId]}
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
                onConfirm={handleConfirm}
                onComplete={openCompleteDialog}
                onCancel={handleCancel}
                onNoShow={handleNoShow}
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
