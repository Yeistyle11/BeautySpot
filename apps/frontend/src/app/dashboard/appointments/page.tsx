"use client";

// Pagina de agenda: lista y calendario de citas, con busqueda, paginacion y acciones de crear/confirmar/cancelar/completar.
import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
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
import { BlockedSlotFormDialog } from "../blocked-slots/blocked-slot-form-dialog";
import {
  blockedSlotSchema,
  blockedSlotsPath,
  emptyForm as emptyBlockedSlotForm,
  toBlockedSlotPayload,
  type BlockedSlot,
} from "../blocked-slots/schemas";
import {
  CompleteAppointmentDialog,
  emptyPaymentDraft,
  type PaymentDraft,
} from "./complete-appointment-dialog";
import {
  appointmentSchema,
  APPOINTMENTS_KEY,
  clientNameSchema,
  CLIENT_NAMES_KEY,
  clientSchema,
  CLIENTS_KEY,
  emptyForm,
  MOTIVOS_DE_CANCELACION,
  professionalSchema,
  PROFESSIONALS_KEY,
  serviceSchema,
  SERVICES_KEY,
  type Appointment,
  type AppointmentForm as FormValues,
  type Client,
  type ClientName,
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

/** Media hora despues, que es lo que dura por defecto un bloqueo rapido. */
function sumarMediaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

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

  // Los bloqueos solo hacen falta en la vista dia, que es la unica que los
  // pinta y la unica desde la que se crean.
  const puedeBloquear = canDo(role, "blocked_slots_create");
  const { data: bloqueos, mutate: recargarBloqueos } = useApi<BlockedSlot[]>(
    viewMode === "day" ? `/booking/blocked-slots?date=${dia}` : null,
    undefined,
    z.array(blockedSlotSchema)
  );

  const [bloqueoForm, setBloqueoForm] = useState(emptyBlockedSlotForm);
  const [bloqueoProfesional, setBloqueoProfesional] = useState<string | null>(
    null
  );
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);

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
  // Servicio -> profesional que lo atiende; los que no estan los hace el titular.
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});

  const [completingAppt, setCompletingAppt] = useState<Appointment | null>(
    null
  );
  const [payment, setPayment] = useState<PaymentDraft>(emptyPaymentDraft);
  const [completingAction, setCompletingAction] = useState(false);

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState<string>(
    MOTIVOS_DE_CANCELACION[0].value
  );
  const [notaCancelacion, setNotaCancelacion] = useState("");

  // Las citas solo traen el id del cliente, que vive en otro servicio. Se piden
  // los nombres de los que hay en pantalla y no la cartera entera: esta ultima
  // llega paginada, asi que dejaba sin nombre a todo el que no cayera en la
  // primera pagina.
  const idsEnPantalla = useMemo(
    () => [...new Set(appointments.map((a) => a.clientId))].sort().join(","),
    [appointments]
  );
  const { data: nombres } = useApi<ClientName[]>(
    idsEnPantalla ? `${CLIENT_NAMES_KEY}?ids=${idsEnPantalla}` : null,
    undefined,
    z.array(clientNameSchema)
  );

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    (nombres ?? []).forEach((c) => {
      map[c.id] = c.name;
    });
    // Lo que el formulario ya tenga cargado sirve igual y evita un parpadeo al
    // crear una cita cuyo cliente aun no esta en el mapa.
    clients.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [nombres, clients]);

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
    async (id: string, action: string, cuerpo: unknown = {}) => {
      try {
        await api.post(`/booking/appointments/${id}/${action}`, cuerpo);
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
  // Cancelar pide motivo: el diálogo se abre con el id y confirma después.
  const handleCancel = useCallback((id: string) => setCancelandoId(id), []);

  const confirmarCancelacion = useCallback(async () => {
    if (!cancelandoId) return;
    await handleAction(cancelandoId, "cancel", {
      motivo: motivoCancelacion,
      nota: notaCancelacion || undefined,
    });
    setCancelandoId(null);
    setMotivoCancelacion(MOTIVOS_DE_CANCELACION[0].value);
    setNotaCancelacion("");
  }, [cancelandoId, handleAction, motivoCancelacion, notaCancelacion]);
  const handleNoShow = useCallback(
    (id: string) => handleAction(id, "no-show"),
    [handleAction]
  );

  const openCompleteDialog = useCallback((appt: Appointment) => {
    setCompletingAppt(appt);
    setPayment(emptyPaymentDraft);
  }, []);

  /** Abre el formulario de bloqueo sembrado con el hueco que se pulsó. */
  const abrirBloqueo = useCallback(
    (professionalId: string, hora: string) => {
      setBloqueoProfesional(professionalId);
      setBloqueoForm({
        ...emptyBlockedSlotForm,
        date: dia,
        startTime: hora,
        endTime: sumarMediaHora(hora),
      });
    },
    [dia]
  );

  const crearBloqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloqueoProfesional) return;
    setGuardandoBloqueo(true);
    try {
      const creados = await api.post<BlockedSlot[]>(
        blockedSlotsPath(bloqueoProfesional),
        toBlockedSlotPayload(bloqueoForm)
      );
      setBloqueoProfesional(null);
      await recargarBloqueos();
      toast.exito(
        creados.length > 1
          ? `Se bloquearon ${creados.length} días`
          : "Agenda bloqueada"
      );
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setGuardandoBloqueo(false);
    }
  };

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
        asignaciones: selectedServices
          .filter(
            (id) => asignaciones[id] && asignaciones[id] !== form.professionalId
          )
          .map((id) => ({ serviceId: id, professionalId: asignaciones[id] })),
      });
      setShowForm(false);
      setForm(emptyForm);
      setSelectedServices([]);
      setAsignaciones({});
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
    setAsignaciones(({ [id]: _quitado, ...resto }) => resto);
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
          asignaciones={asignaciones}
          onAsignar={(serviceId, professionalId) =>
            setAsignaciones((prev) =>
              professionalId
                ? { ...prev, [serviceId]: professionalId }
                : Object.fromEntries(
                    Object.entries(prev).filter(([id]) => id !== serviceId)
                  )
            )
          }
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
                bloqueos={bloqueos ?? []}
                onBloquearHueco={puedeBloquear ? abrirBloqueo : undefined}
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

      <BlockedSlotFormDialog
        open={bloqueoProfesional !== null}
        onClose={() => setBloqueoProfesional(null)}
        form={bloqueoForm}
        onFormChange={setBloqueoForm}
        onSubmit={crearBloqueo}
        guardando={guardandoBloqueo}
      />

      <Dialog
        open={!!cancelandoId}
        onClose={() => setCancelandoId(null)}
        title="Cancelar la cita"
      >
        <div className="space-y-4">
          <Field label="Motivo">
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
            >
              {MOTIVOS_DE_CANCELACION.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nota (opcional)">
            <Textarea
              placeholder="Detalle para el historial"
              value={notaCancelacion}
              onChange={(e) => setNotaCancelacion(e.target.value)}
              rows={2}
            />
          </Field>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={confirmarCancelacion}>
              Cancelar la cita
            </Button>
            <Button variant="outline" onClick={() => setCancelandoId(null)}>
              Volver
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
