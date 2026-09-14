"use client";

// Pagina de clientes: alta, edicion y listado de la base de clientes del negocio.
import { useCallback, useMemo, useState } from "react";
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
  Users,
  UserRound,
} from "lucide-react";
import { TablaDeRegistros } from "@/components/ui/tabla-de-registros";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useApi, paginatedSchema } from "@/lib/swr";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { usePaginatedCrudResource } from "@/lib/use-crud-resource";
import { useOrdenDeTabla } from "@/lib/use-orden-de-tabla";
import { useAltaPorUrl } from "@/lib/alta-por-url";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError, repartirFalloAlGuardar } from "@/lib/error-message";
import { getAppointmentStatus } from "@/lib/status";
import { appointmentSchema, type Appointment } from "@/lib/schemas/appointment";
import { FichaSection } from "./ficha-section";
import { ClientFormDialog } from "./client-form-dialog";
import { MergeDialog } from "./merge-dialog";
import {
  ClientRow,
  COLUMNAS_DE_CLIENTES,
  type CampoDeOrden,
} from "./client-row";
import {
  useAltaDeCliente,
  useEdicionDeCliente,
  useFusionDeClientes,
  useSupresionDeCliente,
} from "./use-clientes";
import {
  clavePosiblesDuplicados,
  clientSchema,
  campoDeFichaSchema,
  servicioBreveSchema,
  CLIENTS_KEY,
  CLIENT_FIELDS_KEY,
  type Client,
  type CampoDeFicha,
  type ServicioBreve,
} from "./schemas";

/** Base de clientes del negocio: alta, edicion, ficha y fusion de duplicados. */
export default function ClientsPage() {
  const toast = useToast();
  const role = useAuthStore((s) => s.role);
  const [search, setSearch] = useState("");
  const {
    orden,
    alternarOrden,
    params: ordenParaElServidor,
  } = useOrdenDeTabla<CampoDeOrden>("name");
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
    params: ordenParaElServidor,
  });

  const alta = useAltaDeCliente(createClient);
  useAltaPorUrl(alta.abrir);
  // Fichas que podrían ser la misma persona, mientras se teclea el nombre. El
  // contacto repetido ya lo rechaza el servidor; esto atrapa al duplicado que
  // no comparte ninguno, que es el que acaba pidiendo una fusión.
  const nombreTecleado = useDebouncedValue(alta.form.name);
  const { data: parecidas } = useApi(
    alta.abierto ? clavePosiblesDuplicados(nombreTecleado) : null,
    undefined,
    paginatedSchema(clientSchema)
  );
  const posiblesDuplicados = useMemo(() => parecidas?.data ?? [], [parecidas]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [conflictoFicha, setConflictoFicha] = useState("");
  const [recargando, setRecargando] = useState(false);

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
  const recargarCliente = useCallback(
    async (id: string): Promise<Client | null> => {
      setRecargando(true);
      try {
        const fresca = clientSchema.parse(
          await api.get(`${CLIENTS_KEY}/${id}`)
        );
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
    },
    [recargarClientes, selectedClient, toast]
  );

  const edicion = useEdicionDeCliente({
    actualizar: updateClient,
    recargarCliente,
    alGuardar: (guardada: Client) => {
      if (selectedClient?.id === guardada.id) setSelectedClient(guardada);
    },
  });

  const fusion = useFusionDeClientes(recargarClientes, () =>
    setSelectedClient(null)
  );

  const supresion = useSupresionDeCliente(recargarClientes, () =>
    setSelectedClient(null)
  );

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
      repartirFalloAlGuardar(err, setConflictoFicha, toast.error);
    } finally {
      setGuardandoFicha(false);
    }
  };

  /** Abre el panel de detalle de una ficha. */
  const openDetail = useCallback((client: Client) => {
    setSelectedClient(client);
  }, []);

  // Los permisos se calculan una vez, no por fila.
  const puedeEditar = canDo(role, "clients_edit");
  const puedeFusionar = canDo(role, "clients_merge");

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
            <Button onClick={alta.abrir}>
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
              <Button onClick={alta.abrir}>Nuevo cliente</Button>
            )
          }
        />
      )}

      {loading ? (
        <LoadingState recurso="los clientes" />
      ) : clients.length > 0 ? (
        <TablaDeRegistros
          titulo="Clientes del negocio"
          columnas={COLUMNAS_DE_CLIENTES}
          orden={orden}
          onOrdenar={alternarOrden}
        >
          {clients.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              puedeEditar={puedeEditar}
              puedeFusionar={puedeFusionar}
              onVerFicha={openDetail}
              onEditar={edicion.abrir}
              onFusionar={fusion.abrir}
              onSuprimir={supresion.pedir}
            />
          ))}
        </TablaDeRegistros>
      ) : null}

      <Pagination meta={meta} onPageChange={setPage} itemLabel="clientes" />

      <ClientFormDialog
        open={alta.abierto}
        onClose={alta.cerrar}
        onSubmit={alta.enviar}
        form={alta.form}
        onChange={alta.setForm}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
        saving={alta.guardando}
        posiblesDuplicados={posiblesDuplicados}
        onAbrirFicha={(cliente) => {
          alta.cerrar();
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
        open={edicion.abierto}
        onClose={edicion.cerrar}
        onSubmit={edicion.enviar}
        form={edicion.form}
        onChange={edicion.setForm}
        title="Editar cliente"
        submitLabel="Guardar cambios"
        saving={edicion.guardando}
        conNotas
        conflicto={edicion.conflicto}
        onRecargar={() => void edicion.recargar()}
        recargando={recargando}
      />

      <MergeDialog
        open={fusion.superviviente !== null}
        onClose={fusion.cerrar}
        onFusionar={fusion.confirmar}
        superviviente={fusion.superviviente}
        // Cualquier otra ficha viva de la cartera: los duplicados no siempre
        // comparten contacto, que es justo por lo que hacen falta.
        candidatos={clients.filter(
          (c) => c.id !== fusion.superviviente?.id && !c.anonymizedAt
        )}
        absorbidoId={fusion.absorbidoId}
        onAbsorbidoChange={fusion.setAbsorbidoId}
        saving={fusion.fusionando}
        error={fusion.error}
      />

      <ConfirmDialog
        open={!!supresion.cliente}
        onClose={supresion.cancelar}
        onConfirm={supresion.confirmar}
        title="Suprimir los datos del cliente"
        variant="destructive"
        confirmLabel="Suprimir los datos"
        pendingLabel="Suprimiendo..."
        pending={supresion.suprimiendo}
        registro={supresion.cliente?.name}
        consecuencias="pierde el nombre, el correo, el teléfono, el documento y las notas. No se puede deshacer, y la ficha ya no se podrá editar."
        seConserva="Sus citas y sus facturas se conservan, porque son documentos contables."
      />
    </div>
  );
}
