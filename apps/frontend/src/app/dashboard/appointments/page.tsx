"use client";

// Pagina de agenda: lista y calendario de citas, con busqueda, paginacion y acciones de crear/confirmar/cancelar/completar.
import { useState, useMemo } from "react";
import { mensajeDeError } from "@/lib/error-message";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { FilterChip } from "@/components/ui/filter-chip";
import {
  Calendar,
  Plus,
  Search,
  X,
  List,
  CalendarDays,
  Columns3,
  UserPlus,
  Ban,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { fechasDeLaSemana, toLocalDateKey } from "@/lib/utils";
import { useApi, paginatedSchema, revalidatePrefix } from "@/lib/swr";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAppointmentStatus } from "@/lib/status";
import { AppointmentForm } from "./appointment-form";
import { WalkInDialog } from "./walk-in-dialog";
import { AppointmentCard, COLUMNAS_DE_AGENDA } from "./appointment-card";
import { TablaDeRegistros } from "@/components/ui/tabla-de-registros";
import { useOrdenDeTabla } from "@/lib/use-orden-de-tabla";
import { RescheduleDialog } from "./reschedule-dialog";
import { BlockedSlotFormDialog } from "../blocked-slots/blocked-slot-form-dialog";
import { blockedSlotSchema, type BlockedSlot } from "../blocked-slots/schemas";
import { businessHourSchema, type BusinessHour } from "../settings/schemas";
import { CompleteAppointmentDialog } from "./complete-appointment-dialog";
import { useAccionesDeCita } from "./use-acciones-de-cita";
import { useBloqueoRapido } from "./use-bloqueo-rapido";
import { useCierreDeCita } from "./use-cierre-de-cita";
import { useWalkIn } from "./use-walk-in";
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

// La rejilla semanal se descarga solo al cambiar a la vista calendario.
const CalendarView = dynamic(
  () => import("@/components/calendar-view").then((m) => m.CalendarView),
  {
    ssr: false,
    loading: () => <LoadingState recurso="la agenda" />,
  }
);

const DayView = dynamic(
  () => import("@/components/day-view").then((m) => m.DayView),
  {
    ssr: false,
    loading: () => <LoadingState recurso="la agenda" />,
  }
);

/** Campos por los que el servidor sabe ordenar la agenda. */
type CampoDeOrden = "date";

/**
 * Pestaña de las citas cuya hora pasó sin que se cerraran. No es un estado de
 * la cita: cruza las pendientes y las confirmadas.
 */
const VENCIDAS = "VENCIDAS";

/** Estados en el orden del ciclo de vida de una cita. */
const ESTADOS_EN_ORDEN = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/** Las tres formas de ver la agenda, en el orden en que se ofrecen. */
const VISTAS = [
  { id: "list", etiqueta: "Lista", icono: List },
  { id: "day", etiqueta: "Día", icono: Columns3 },
  { id: "calendar", etiqueta: "Semana", icono: CalendarDays },
] as const;

/** Agenda del negocio en lista, dia o semana, con las acciones sobre cada cita. */
export default function AppointmentsPage() {
  const role = useAuthStore((s) => s.role);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "day" | "calendar">("list");
  /** Pestaña de estado en la vista lista; vacia son todas. */
  const [estado, setEstado] = useState("");
  const {
    orden,
    alternarOrden,
    params: ordenParaElServidor,
  } = useOrdenDeTabla<CampoDeOrden>("date", "desc");
  const [dia, setDia] = useState(() => toLocalDateKey(new Date()));

  // El calendario pide el maximo del backend (100); la lista pagina de 20.
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
    // En lista, el estado y el orden los resuelve el servidor.
    params:
      viewMode === "day"
        ? { date: dia }
        : viewMode === "list"
          ? {
              ...(estado === VENCIDAS
                ? { vencidas: "true" }
                : estado
                  ? { status: estado }
                  : {}),
              ...ordenParaElServidor,
            }
          : undefined,
    limit: viewMode === "list" ? undefined : 100,
    // La busqueda por texto solo se aplica a la vista lista.
    search: viewMode === "list" ? search : "",
  });

  // Los contadores salen del servidor, sobre todo el historial.
  const { data: resumen } = useApi<Record<string, number>>(
    viewMode === "list"
      ? `/booking/appointments/resumen-por-estado${search ? `?search=${encodeURIComponent(search)}` : ""}`
      : null,
    undefined,
    z.record(z.string(), z.number())
  );

  /** Solo se ofrecen las pestañas de estados que existen. */
  const pestanas = useMemo(() => {
    const cuenta = resumen ?? {};
    // Las vencidas cruzan dos estados y suman aparte del total.
    const total = ESTADOS_EN_ORDEN.reduce((a, e) => a + (cuenta[e] ?? 0), 0);
    const porCerrar = cuenta[VENCIDAS] ?? 0;
    return [
      { valor: "", etiqueta: "Todas", n: total },
      ...(porCerrar
        ? [{ valor: VENCIDAS, etiqueta: "Pendientes de cerrar", n: porCerrar }]
        : []),
      ...ESTADOS_EN_ORDEN.filter((e) => cuenta[e]).map((e) => ({
        valor: e,
        etiqueta: getAppointmentStatus(e).label,
        n: cuenta[e],
      })),
    ];
  }, [resumen]);

  // La vista dia pide los bloqueos de ese dia; la semana, los de los siete,
  // que es lo que le faltaba para no pintar como libre la tarde de quien esta
  // de vacaciones. La lista no los necesita.
  const puedeBloquear = canDo(role, "blocked_slots_create");
  const semana = useMemo(() => fechasDeLaSemana(dia), [dia]);
  const bloqueosKey =
    viewMode === "day"
      ? `/booking/blocked-slots?date=${dia}`
      : viewMode === "calendar"
        ? `/booking/blocked-slots?date=${semana[0]}&hasta=${semana[6]}`
        : null;
  const { data: bloqueos, mutate: recargarBloqueos } = useApi<BlockedSlot[]>(
    bloqueosKey,
    undefined,
    z.array(blockedSlotSchema)
  );

  // El horario del negocio, para marcar como cerrados los dias sin apertura.
  const { data: horarios } = useApi<BusinessHour[]>(
    "/core/business-hours",
    undefined,
    z.array(businessHourSchema)
  );
  const diasAbiertos = useMemo(
    () =>
      horarios
        ? [...new Set(horarios.filter((h) => h.active).map((h) => h.dayOfWeek))]
        : undefined,
    [horarios]
  );

  // Los profesionales se cargan siempre: ademas del formulario, la lista de citas
  // los necesita para mostrar el nombre en vez del identificador.
  const { data: professionals, mutate: recargarProfesionales } = useApi<
    Professional[]
  >(PROFESSIONALS_KEY, undefined, z.array(professionalSchema));

  const [form, setForm] = useState<FormValues>(emptyForm);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  // Servicio -> profesional que lo atiende; los que no estan los hace el titular.
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});

  const walkIn = useWalkIn(asignaciones);

  // Servicios y clientes solo hacen falta con un formulario abierto, y los dos
  // que los piden son el de nueva cita y el de walk-in.
  const necesitaCatalogos = showForm || walkIn.abierto;
  const { data: services } = useApi<Service[]>(
    necesitaCatalogos ? SERVICES_KEY : null,
    undefined,
    z.array(serviceSchema)
  );
  const { data: clientsPage, mutate: recargarClientes } = useApi(
    necesitaCatalogos ? CLIENTS_KEY : null,
    undefined,
    paginatedSchema(clientSchema)
  );
  // Memoizado porque alimenta a clientMap: un array nuevo en cada render
  // invalida ese useMemo y, con el, la memoizacion de toda la lista.
  const clients: Client[] = useMemo(
    () => clientsPage?.data ?? [],
    [clientsPage]
  );

  // Pide a core, por id, los nombres de los clientes que salen en pantalla.
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

  const acciones = useAccionesDeCita();
  const cierre = useCierreDeCita();
  const bloqueo = useBloqueoRapido(dia, recargarBloqueos);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Solo van los ids: el backend resuelve nombre, precio y duracion contra el
      // catalogo y los congela con la cita. En asignaciones viajan solo los
      // servicios que atiende otro; lo que no se reparte se lo queda el titular.
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
      setError(mensajeDeError(err, "Error al crear la cita"));
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
      <PageHeader
        titulo="Agenda"
        descripcion="Gestiona tus citas"
        accion={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              {VISTAS.map(({ id, etiqueta, icono: Icono }) => (
                <FilterChip
                  key={id}
                  variante="segment"
                  activo={viewMode === id}
                  onClick={() => setViewMode(id)}
                  className={
                    viewMode === id
                      ? "bg-primary text-primary-foreground flex items-center gap-1 rounded-none px-3 py-1.5 shadow-none"
                      : "flex items-center gap-1 rounded-none px-3 py-1.5"
                  }
                >
                  <Icono className="h-4 w-4" /> {etiqueta}
                </FilterChip>
              ))}
            </div>
            {canDo(role, "appointments_create") && (
              <Button variant="outline" onClick={walkIn.abrir}>
                <UserPlus className="mr-2 h-4 w-4" /> Walk-in
              </Button>
            )}
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
        }
      />

      {showForm && (
        <AppointmentForm
          form={form}
          onChange={setForm}
          onSubmit={handleCreate}
          professionals={professionals ?? []}
          clients={clients ?? []}
          services={services ?? []}
          onRecargarClientes={recargarClientes}
          onRecargarProfesionales={recargarProfesionales}
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
        <Card className="shadow-flat border-0">
          <CardContent className="p-4">
            {loading ? (
              <LoadingState recurso="las citas" />
            ) : (
              <DayView
                appointments={appointments}
                professionals={professionals ?? []}
                date={dia}
                onDateChange={setDia}
                onComplete={cierre.abrir}
                onConfirm={acciones.confirmar}
                onCancel={acciones.pedirCancelacion}
                onNoShow={acciones.marcarAusencia}
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
                clientNames={clientMap}
                bloqueos={bloqueos ?? []}
                diasAbiertos={diasAbiertos}
                onBloquearHueco={puedeBloquear ? bloqueo.abrir : undefined}
              />
            )}
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <Card className="shadow-flat border-0">
          <CardContent className="p-4">
            {loading ? (
              <LoadingState recurso="las citas" />
            ) : (
              <CalendarView
                appointments={appointments}
                date={dia}
                onDateChange={setDia}
                onComplete={cierre.abrir}
                onConfirm={acciones.confirmar}
                onCancel={acciones.pedirCancelacion}
                onNoShow={acciones.marcarAusencia}
                canConfirm={canDo(role, "appointments_confirm")}
                canCancel={canDo(role, "appointments_cancel")}
                clientNames={clientMap}
                bloqueos={bloqueos ?? []}
                nombresDeProfesional={professionalMap}
                diasAbiertos={diasAbiertos}
                horarios={horarios}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pestanas.length > 1 && (
            <Tabs value={estado} onValueChange={setEstado}>
              <TabsList className="flex-wrap">
                {pestanas.map((p) => (
                  <TabsTrigger key={p.valor || "todas"} value={p.valor}>
                    {p.etiqueta} ({p.n})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {loading ? (
            <LoadingState recurso="las citas" />
          ) : loadError ? (
            <ErrorDeCarga
              error={loadError}
              recurso="las citas"
              onReintentar={() => recargar()}
            />
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              titulo={search ? "Ninguna cita coincide" : "Aún no hay citas"}
              descripcion={
                search
                  ? "Prueba con otro nombre, correo, teléfono o servicio."
                  : "Cuando se agende la primera, aparecerá aquí."
              }
            />
          ) : (
            <TablaDeRegistros
              titulo="Citas del negocio"
              columnas={COLUMNAS_DE_AGENDA}
              orden={orden}
              onOrdenar={alternarOrden}
            >
              {appointments.map((appt) => (
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
                  canReschedule={canDo(role, "appointments_reschedule")}
                  onConfirm={acciones.confirmar}
                  onComplete={cierre.abrir}
                  onCancel={acciones.pedirCancelacion}
                  onNoShow={acciones.marcarAusencia}
                  onReschedule={acciones.abrirReagendar}
                />
              ))}
            </TablaDeRegistros>
          )}
          <Pagination meta={meta} onPageChange={setPage} itemLabel="citas" />
        </div>
      )}

      <RescheduleDialog
        // Remonta al cambiar de cita: la fecha y la hora del formulario salen
        // de la cita que se esta moviendo.
        key={acciones.reagendando?.id}
        open={!!acciones.reagendando}
        onClose={acciones.cerrarReagendar}
        appointment={acciones.reagendando}
        onConfirm={acciones.confirmarReagendado}
        pending={acciones.moviendo}
        error={acciones.errorAlMover}
      />

      <CompleteAppointmentDialog
        open={!!cierre.cita}
        onClose={cierre.cancelar}
        appointment={cierre.cita}
        payment={cierre.cobro}
        onPaymentChange={cierre.setCobro}
        onComplete={cierre.confirmar}
        pending={cierre.cerrando}
      />

      <WalkInDialog
        open={walkIn.abierto}
        onClose={walkIn.cerrar}
        onSubmit={walkIn.enviar}
        form={walkIn.form}
        onChange={walkIn.setForm}
        professionals={professionals ?? []}
        clients={clients ?? []}
        services={services ?? []}
        onRecargarClientes={recargarClientes}
        onRecargarProfesionales={recargarProfesionales}
        selectedServices={walkIn.servicios}
        onToggleService={walkIn.alternarServicio}
        saving={walkIn.guardando}
        error={walkIn.error}
      />

      <BlockedSlotFormDialog
        open={bloqueo.profesional !== null}
        onClose={bloqueo.cerrar}
        form={bloqueo.form}
        onFormChange={bloqueo.setForm}
        onSubmit={bloqueo.enviar}
        guardando={bloqueo.guardando}
      />

      <Dialog
        open={!!acciones.cancelandoId}
        onClose={acciones.cerrarCancelacion}
        title="Cancelar la cita"
        descripcion="El motivo queda en el historial y en el aviso al cliente."
        icono={Ban}
        pie={
          <>
            <Button variant="outline" onClick={acciones.cerrarCancelacion}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={acciones.confirmarCancelacion}
            >
              Cancelar la cita
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Motivo">
            <Select
              value={acciones.motivoCancelacion}
              onChange={(e) => acciones.setMotivoCancelacion(e.target.value)}
            >
              {MOTIVOS_DE_CANCELACION.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nota (opcional)">
            <Textarea
              placeholder="Detalle para el historial"
              value={acciones.notaCancelacion}
              onChange={(e) => acciones.setNotaCancelacion(e.target.value)}
              rows={2}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
