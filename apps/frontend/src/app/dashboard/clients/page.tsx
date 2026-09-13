"use client";

// Pagina de clientes: alta, edicion y listado de la base de clientes del negocio.
import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Plus,
  Search,
  Phone,
  Mail,
  Award,
  Calendar,
  Edit,
  Trash2,
  Users,
  Merge,
  Eye,
  UserRound,
} from "lucide-react";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
  type DireccionDeOrden,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { api } from "@/lib/api";
import { esConflictoDeEdicion } from "@/lib/api-error";
import { useApi, paginatedSchema } from "@/lib/swr";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { usePaginatedCrudResource } from "@/lib/use-crud-resource";
import { useAltaPorUrl } from "@/lib/alta-por-url";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
import { getAppointmentStatus } from "@/lib/status";
import { appointmentSchema, type Appointment } from "@/lib/schemas/appointment";
import { FichaSection } from "./ficha-section";
import {
  ClientFormDialog,
  emptyClientForm,
  type ClientForm,
} from "./client-form-dialog";
import { MergeDialog } from "./merge-dialog";
import {
  clavePosiblesDuplicados,
  clientSchema,
  cambiosDelCliente,
  campoDeFichaSchema,
  servicioBreveSchema,
  CLIENTS_KEY,
  CLIENT_FIELDS_KEY,
  type Client,
  type CampoDeFicha,
  type ServicioBreve,
} from "./schemas";

/** Campos por los que ordena el servidor. La lista viene paginada. */
type CampoDeOrden = "name" | "createdAt";

const COLUMNAS: ColumnaDeTabla<CampoDeOrden>[] = [
  { label: "Cliente", campo: "name" },
  { label: "Email", ocultaEnMovil: true },
  { label: "Teléfono" },
  { label: "Alta", campo: "createdAt", ocultaEnMovil: true },
  { label: "Puntos", alineacion: "right", ocultaEnMovil: true },
];

export default function ClientsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const [search, setSearch] = useState("");
  const [orden, setOrden] = useState<{
    campo: CampoDeOrden;
    direccion: DireccionDeOrden;
  }>({ campo: "name", direccion: "asc" });

  /** Alterna el sentido si se repite la columna; si no, empieza ascendente. */
  const alternarOrden = (campo: CampoDeOrden) =>
    setOrden((actual) =>
      actual.campo === campo
        ? { campo, direccion: actual.direccion === "asc" ? "desc" : "asc" }
        : { campo, direccion: "asc" }
    );
  const {
    items: clients,
    meta,
    setPage,
    isLoading: loading,
    error: loadError,
    reload: recargarClientes,
    isEmptySearch,
    create: createClient,
    update: updateClient,
  } = usePaginatedCrudResource<Client>({
    basePath: CLIENTS_KEY,
    itemSchema: clientSchema,
    search,
    params: {
      sort: orden.campo,
      order: orden.direccion === "asc" ? "ASC" : "DESC",
    },
  });

  const [createDialog, setCreateDialog] = useState(false);
  useAltaPorUrl(() => setCreateDialog(true));
  const [createForm, setCreateForm] = useState<ClientForm>(emptyClientForm);
  const [savingCreate, setSavingCreate] = useState(false);
  // Fichas que podrían ser la misma persona, mientras se teclea el nombre. El
  // contacto repetido ya lo rechaza el servidor; esto atrapa al duplicado que
  // no comparte ninguno, que es el que acaba pidiendo una fusión.
  const nombreTecleado = useDebouncedValue(createForm.name);
  const { data: parecidas } = useApi(
    createDialog ? clavePosiblesDuplicados(nombreTecleado) : null,
    undefined,
    paginatedSchema(clientSchema)
  );
  const posiblesDuplicados = useMemo(() => parecidas?.data ?? [], [parecidas]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<ClientForm>({
    ...emptyClientForm,
    notes: "",
  });
  // La ficha tal como se cargo, para enviar en el guardado solo lo modificado.
  const [editOriginal, setEditOriginal] = useState<ClientForm>({
    ...emptyClientForm,
    notes: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Version de la ficha al abrir el formulario. Viaja en el guardado para que
  // el servidor avise si otra persona la cambio mientras tanto, en vez de
  // dejar que la ultima escritura gane sin que nadie se entere.
  const [editVersion, setEditVersion] = useState<string | null>(null);
  const [conflictoEdicion, setConflictoEdicion] = useState("");
  const [conflictoFicha, setConflictoFicha] = useState("");
  const [recargando, setRecargando] = useState(false);

  const [clienteASuprimir, setClienteASuprimir] = useState<Client | null>(null);
  const [fusionCon, setFusionCon] = useState<Client | null>(null);
  const [absorbidoId, setAbsorbidoId] = useState("");
  const [fusionando, setFusionando] = useState(false);
  const [fusionError, setFusionError] = useState("");
  const [suprimiendo, setSuprimiendo] = useState(false);

  const { data: campos } = useApi<CampoDeFicha[] | null>(
    CLIENT_FIELDS_KEY,
    undefined,
    z.array(campoDeFichaSchema).nullable()
  );
  const { data: servicios } = useApi<ServicioBreve[] | null>(
    "/core/services",
    undefined,
    z.array(servicioBreveSchema).nullable()
  );
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  /** Trae del servidor la ficha tal como esta guardada ahora mismo. */
  const recargarCliente = async (id: string): Promise<Client | null> => {
    setRecargando(true);
    try {
      const fresca = clientSchema.parse(await api.get(`${CLIENTS_KEY}/${id}`));
      await recargarClientes();
      if (selectedClient?.id === id) setSelectedClient(fresca);
      return fresca;
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
      return null;
    } finally {
      setRecargando(false);
    }
  };

  const handleSaveFicha = async (ficha: Record<string, unknown>) => {
    if (!selectedClient) return;
    setGuardandoFicha(true);
    setConflictoFicha("");
    try {
      const guardado = clientSchema.parse(
        await updateClient(selectedClient.id, {
          ficha,
          updatedAt: selectedClient.updatedAt,
        })
      );
      // Con la version nueva, guardar dos veces seguidas no choca consigo mismo.
      setSelectedClient(guardado);
      toast.exito("Ficha guardada");
    } catch (err) {
      logger.error(err);
      if (esConflictoDeEdicion(err)) setConflictoFicha(mensajeDeError(err));
      else toast.error(mensajeDeError(err));
    } finally {
      setGuardandoFicha(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await createClient({
        name: createForm.name.trim(),
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        birthDate: createForm.birthDate || undefined,
      });
      setCreateForm(emptyClientForm);
      setCreateDialog(false);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSavingCreate(false);
    }
  };

  const openFusion = (client: Client) => {
    setFusionCon(client);
    setAbsorbidoId("");
    setFusionError("");
  };

  const fusionar = async () => {
    if (!fusionCon || !absorbidoId) return;
    setFusionando(true);
    setFusionError("");
    try {
      await api.post(`/core/clients/${fusionCon.id}/merge`, { absorbidoId });
      setFusionCon(null);
      setSelectedClient(null);
      await recargarClientes();
      toast.exito("Fichas fusionadas");
    } catch (err) {
      logger.error(err);
      // El motivo se lee en el diálogo: dos cuentas distintas o una ficha ya
      // fusionada piden revisar antes de reintentar.
      setFusionError(mensajeDeError(err));
    } finally {
      setFusionando(false);
    }
  };

  const openDetail = (client: Client) => {
    setSelectedClient(client);
  };

  /** Ejerce el derecho de supresion, previa confirmacion explicita. */
  const handleAnonymize = async () => {
    if (!clienteASuprimir) return;
    setSuprimiendo(true);
    try {
      await api.post(`/core/clients/${clienteASuprimir.id}/anonymize`, {});
      await recargarClientes();
      setClienteASuprimir(null);
      setSelectedClient(null);
      toast.exito("Los datos del cliente se suprimieron");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSuprimiendo(false);
    }
  };

  /** Los campos del formulario, tal como se leen de una ficha. */
  const comoFormulario = (client: Client): ClientForm => ({
    name: client.name,
    email: client.email || "",
    phone: client.phone || "",
    notes: client.notes || "",
    birthDate: client.birthDate || "",
  });

  const openEdit = (client: Client) => {
    const cargado = comoFormulario(client);
    setEditId(client.id);
    setEditForm(cargado);
    // Se guarda la ficha tal como se cargo para poder enviar despues solo lo
    // que el usuario haya tocado.
    setEditOriginal(cargado);
    setEditVersion(client.updatedAt);
    setConflictoEdicion("");
    setEditDialog(true);
  };

  /** Cambia lo escrito por lo que hay guardado, dejando el formulario abierto. */
  const recargarEnEdicion = async () => {
    if (!editId) return;
    const fresca = await recargarCliente(editId);
    if (!fresca) return;
    const cargada = comoFormulario(fresca);
    setEditForm(cargada);
    setEditOriginal(cargada);
    setEditVersion(fresca.updatedAt);
    setConflictoEdicion("");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    const cambios = cambiosDelCliente(editOriginal, editForm);
    // Sin cambios no hay nada que mandar, y un PATCH vacio solo serviria para
    // pisar la ficha con lo que esta pestana tenia cargado.
    if (Object.keys(cambios).length === 0) {
      setEditDialog(false);
      setEditId(null);
      return;
    }
    setSavingEdit(true);
    setConflictoEdicion("");
    try {
      const guardada = clientSchema.parse(
        await updateClient(editId, {
          ...cambios,
          updatedAt: editVersion ?? undefined,
        })
      );
      setEditDialog(false);
      setEditId(null);
      if (selectedClient?.id === editId) setSelectedClient(guardada);
    } catch (err) {
      logger.error(err);
      // El formulario se queda abierto con lo escrito: hay algo que decidir, y
      // un aviso que se va solo no da tiempo a decidirlo.
      if (esConflictoDeEdicion(err)) setConflictoEdicion(mensajeDeError(err));
      else toast.error(mensajeDeError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const detailKey = selectedClient
    ? `/booking/appointments?clientId=${selectedClient.id}`
    : null;
  const { data: historial, isLoading: loadingDetail } = useApi(
    detailKey,
    undefined,
    paginatedSchema(appointmentSchema)
  );
  const clientAppointments: Appointment[] = historial?.data ?? [];

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        descripcion="Administra tu cartera de clientes"
        accion={
          canDo(role, "clients_create") && (
            <Button onClick={() => setCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          )
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            aria-label="Buscar cliente"
            placeholder="Buscar cliente..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isEmptySearch && (
        <p className="text-muted-foreground py-8 text-center">
          No se encontraron clientes para &quot;{search}&quot;
        </p>
      )}

      {loadError && (
        <ErrorDeCarga
          error={loadError}
          recurso="los clientes"
          onReintentar={() => void recargarClientes()}
        />
      )}

      {!loading && !loadError && !isEmptySearch && clients.length === 0 && (
        <EmptyState
          icon={Users}
          titulo="Aún no hay clientes"
          descripcion="Registra a quien atiendes para llevar su historial y sus citas."
          accion={
            canDo(role, "clients_create") && (
              <Button onClick={() => setCreateDialog(true)}>
                Nuevo cliente
              </Button>
            )
          }
        />
      )}

      {loading ? (
        <LoadingState recurso="los clientes" />
      ) : clients.length > 0 ? (
        <TablaDeRegistros
          titulo="Clientes del negocio"
          columnas={COLUMNAS}
          orden={orden}
          onOrdenar={alternarOrden}
        >
          {clients.map((c) => (
            <FilaDeTabla
              key={c.id}
              acciones={
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openDetail(c)}
                    aria-label={`Ver la ficha de ${c.name}`}
                    title="Ver ficha"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {/* Una ficha anonimizada no se edita ni se fusiona. */}
                  {canDo(role, "clients_edit") && !c.anonymizedAt && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c)}
                        aria-label={`Editar a ${c.name}`}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDo(role, "clients_merge") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openFusion(c)}
                          aria-label={`Fusionar la ficha de ${c.name} con otra`}
                          title="Fusionar"
                        >
                          <Merge className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                        onClick={() => setClienteASuprimir(c)}
                        aria-label={`Suprimir los datos de ${c.name}`}
                        title="Suprimir datos"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </>
              }
            >
              <CeldaPrincipal
                inicial={c.name.charAt(0)}
                titulo={
                  /* El nombre abre la ficha, tambien con teclado. */
                  <button
                    type="button"
                    onClick={() => openDetail(c)}
                    aria-label={`Ver la ficha de ${c.name}`}
                    className="focus-visible:ring-ring hover:text-primary rounded-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                  >
                    {c.name}
                  </button>
                }
              />
              <CeldaDeTabla apagada ocultaEnMovil>
                {c.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </span>
                ) : (
                  "—"
                )}
              </CeldaDeTabla>
              <CeldaDeTabla apagada>
                {c.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {c.phone}
                  </span>
                ) : (
                  "—"
                )}
              </CeldaDeTabla>
              <CeldaDeTabla apagada ocultaEnMovil>
                {c.createdAt ? formatDate(c.createdAt) : "—"}
              </CeldaDeTabla>
              <CeldaDeTabla alineacion="right" ocultaEnMovil>
                {c.loyaltyPoints > 0 ? (
                  <span className="text-warning inline-flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    {c.loyaltyPoints}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </CeldaDeTabla>
            </FilaDeTabla>
          ))}
        </TablaDeRegistros>
      ) : null}

      <Pagination meta={meta} onPageChange={setPage} itemLabel="clientes" />

      <ClientFormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        onSubmit={handleCreate}
        form={createForm}
        onChange={setCreateForm}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
        saving={savingCreate}
        posiblesDuplicados={posiblesDuplicados}
        onAbrirFicha={(cliente) => {
          setCreateDialog(false);
          openDetail(cliente);
        }}
      />

      <Dialog
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title="Detalle del cliente"
        descripcion="Su contacto, sus puntos y sus últimas citas."
        icono={UserRound}
        wide
        pie={
          <Button variant="outline" onClick={() => setSelectedClient(null)}>
            Cerrar
          </Button>
        }
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-info-soft text-info-soft-foreground text-2xl font-bold">
                    {selectedClient.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold">{selectedClient.name}</h3>
                  <div className="mt-1 space-y-0.5">
                    {selectedClient.email && (
                      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <Mail className="h-3 w-3" />
                        {selectedClient.email}
                      </p>
                    )}
                    {selectedClient.phone && (
                      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <Phone className="h-3 w-3" />
                        {selectedClient.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedClient.loyaltyPoints > 0 && (
              <div className="bg-warning-soft flex items-center gap-2 rounded-lg p-3">
                <Award className="text-warning-soft-foreground h-5 w-5" />
                <span className="text-warning-soft-foreground font-medium">
                  {selectedClient.loyaltyPoints} puntos de fidelidad
                </span>
              </div>
            )}

            <FichaSection
              // Remonta al cambiar de cliente, porque el dialogo no se
              // desmonta entre uno y otro, y al recargar, para que el
              // borrador arranque con lo que hay guardado.
              key={`${selectedClient.id}-${selectedClient.updatedAt}`}
              campos={campos ?? []}
              servicios={servicios ?? []}
              valores={selectedClient.ficha ?? {}}
              onSave={handleSaveFicha}
              saving={guardandoFicha}
              conflicto={conflictoFicha}
              onRecargar={() => {
                setConflictoFicha("");
                void recargarCliente(selectedClient.id);
              }}
              recargando={recargando}
              puedeEditar={
                canDo(role, "clients_edit") && !selectedClient.anonymizedAt
              }
            />

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4" /> Historial de citas
              </h4>
              {loadingDetail ? (
                <LoadingState recurso="el historial" />
              ) : (clientAppointments ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No hay citas registradas
                </p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {(clientAppointments ?? []).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {a.appointmentServices
                            .map((s) => s.serviceName)
                            .join(", ")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(a.date)} · {formatTime(a.startTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {formatCurrency(a.totalAmount)}
                        </span>
                        <Badge
                          variant={getAppointmentStatus(a.status).variant}
                          className="text-xs"
                        >
                          {getAppointmentStatus(a.status).label}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <ClientFormDialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        onSubmit={handleUpdate}
        form={editForm}
        onChange={setEditForm}
        title="Editar cliente"
        submitLabel="Guardar cambios"
        saving={savingEdit}
        conNotas
        conflicto={conflictoEdicion}
        onRecargar={() => void recargarEnEdicion()}
        recargando={recargando}
      />

      <MergeDialog
        open={fusionCon !== null}
        onClose={() => setFusionCon(null)}
        onFusionar={fusionar}
        superviviente={fusionCon}
        // Cualquier otra ficha viva de la cartera: los duplicados no siempre
        // comparten contacto, que es justo por lo que hacen falta.
        candidatos={clients.filter(
          (c) => c.id !== fusionCon?.id && !c.anonymizedAt
        )}
        absorbidoId={absorbidoId}
        onAbsorbidoChange={setAbsorbidoId}
        saving={fusionando}
        error={fusionError}
      />

      <ConfirmDialog
        open={!!clienteASuprimir}
        onClose={() => setClienteASuprimir(null)}
        onConfirm={handleAnonymize}
        title="Suprimir los datos del cliente"
        variant="destructive"
        confirmLabel="Suprimir los datos"
        pendingLabel="Suprimiendo..."
        pending={suprimiendo}
        registro={clienteASuprimir?.name}
        consecuencias="pierde el nombre, el correo, el teléfono, el documento y las notas. No se puede deshacer, y la ficha ya no se podrá editar."
        seConserva="Sus citas y sus facturas se conservan, porque son documentos contables."
      />
    </div>
  );
}
