"use client";

// Pagina de clientes: alta, edicion y listado de la base de clientes del negocio.
import { useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useApi, paginatedSchema } from "@/lib/swr";
import { usePaginatedCrudResource } from "@/lib/use-crud-resource";
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
import {
  clientSchema,
  campoDeFichaSchema,
  servicioBreveSchema,
  CLIENTS_KEY,
  CLIENT_FIELDS_KEY,
  type Client,
  type CampoDeFicha,
  type ServicioBreve,
} from "./schemas";

export default function ClientsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const [search, setSearch] = useState("");
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
  });

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<ClientForm>(emptyClientForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<ClientForm>({
    ...emptyClientForm,
    notes: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [clienteASuprimir, setClienteASuprimir] = useState<Client | null>(null);
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

  const handleSaveFicha = async (ficha: Record<string, unknown>) => {
    if (!selectedClient) return;
    setGuardandoFicha(true);
    try {
      await updateClient(selectedClient.id, { ficha });
      setSelectedClient({ ...selectedClient, ficha });
      toast.exito("Ficha guardada");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setGuardandoFicha(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await createClient({
        name: createForm.name,
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

  const openEdit = (client: Client) => {
    setEditId(client.id);
    setEditForm({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      notes: client.notes || "",
      birthDate: client.birthDate || "",
    });
    setEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    try {
      await updateClient(editId, {
        name: editForm.name,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        notes: editForm.notes || undefined,
        // Vaciar el campo borra la fecha: va null, no undefined.
        birthDate: editForm.birthDate || null,
      });
      setEditDialog(false);
      setEditId(null);
      if (selectedClient?.id === editId) {
        setSelectedClient({
          ...selectedClient,
          name: editForm.name,
          email: editForm.email || null,
          phone: editForm.phone || null,
        });
      }
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
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
          titulo="Aun no hay clientes"
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <LoadingState recurso="los clientes" />
        ) : (
          clients.map((c) => (
            <Card
              key={c.id}
              className="focus-within:ring-ring border-0 shadow-sm transition-shadow [contain-intrinsic-size:auto_140px] [content-visibility:auto] focus-within:ring-2 hover:shadow-md"
            >
              {/* La tarjeta entera abre la ficha, y es la unica via de acceso a
                  ella: tiene que ser un boton para que llegue el teclado. */}
              <button
                type="button"
                onClick={() => openDetail(c)}
                aria-label={`Ver la ficha de ${c.name}`}
                className="w-full cursor-pointer text-left focus:outline-none"
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-info-soft text-info-soft-foreground font-bold">
                        {c.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <div className="mt-1 space-y-0.5">
                        {c.email && (
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </p>
                        )}
                        {c.phone && (
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {c.loyaltyPoints > 0 && (
                    <div className="text-warning mt-3 flex items-center gap-1.5 text-sm">
                      <Award className="h-4 w-4" />
                      {c.loyaltyPoints} puntos
                    </div>
                  )}
                </CardContent>
              </button>
            </Card>
          ))
        )}
      </div>

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
      />

      <Dialog
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title="Detalle del cliente"
        wide
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
              <div className="flex gap-2">
                {canDo(role, "clients_edit") &&
                  !selectedClient.anonymizedAt && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(selectedClient)}
                      >
                        <Edit className="mr-1 h-3 w-3" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setClienteASuprimir(selectedClient)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Suprimir datos
                      </Button>
                    </>
                  )}
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
              // Remonta al cambiar de cliente: el dialogo no se desmonta entre
              // uno y otro, y el borrador tiene que empezar de cero.
              key={selectedClient.id}
              campos={campos ?? []}
              servicios={servicios ?? []}
              valores={selectedClient.ficha ?? {}}
              onSave={handleSaveFicha}
              saving={guardandoFicha}
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
      >
        <p className="text-sm">
          Se borrarán el nombre, el correo, el teléfono, el documento y las
          notas de <strong>{clienteASuprimir?.name}</strong>. Sus citas y sus
          facturas se conservan, porque son documentos contables.
        </p>
        <p className="text-muted-foreground text-sm">
          No se puede deshacer, y la ficha ya no se podrá editar.
        </p>
      </ConfirmDialog>
    </div>
  );
}
