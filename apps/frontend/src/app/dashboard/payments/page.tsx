"use client";

// Pagina de pagos: lista de pagos registrados con resumen, busqueda por fecha y paginacion.
import { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { DollarSign, Plus, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { toLocalDateKey } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi, paginatedSchema, revalidatePrefix } from "@/lib/swr";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { FilterChip } from "@/components/ui/filter-chip";
import { PaymentSummaryCards } from "./payment-summary";
import { PaymentCard } from "./payment-card";
import { CreatePaymentDialog, EditPaymentDialog } from "./payment-dialogs";
import {
  clientSchema,
  CLIENTS_KEY,
  dailySummarySchema,
  emptyCreateForm,
  emptyEditForm,
  METHOD_FILTERS,
  METHOD_LABELS,
  paymentSchema,
  PAYMENTS_KEY,
  type Client,
  type CreateForm,
  type DailySummary,
  type EditForm,
  type Payment,
} from "./schemas";

export default function PaymentsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const [filterMethod, setFilterMethod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // El backend solo aplica el rango cuando recibe ambos extremos, asi que se
  // completa el que falte para que filtrar por una sola fecha no sea un no-op.
  const dateRange = useMemo(() => {
    if (!dateFrom && !dateTo) return { from: undefined, to: undefined };
    return {
      from: dateFrom || "1970-01-01",
      to: dateTo || toLocalDateKey(new Date()),
    };
  }, [dateFrom, dateTo]);

  const {
    items: payments,
    meta,
    setPage,
    isLoading: loading,
    error: loadError,
    mutate: recargar,
  } = usePaginatedList<Payment>({
    basePath: PAYMENTS_KEY,
    itemSchema: paymentSchema,
    params: {
      method: filterMethod !== "all" ? filterMethod : undefined,
      from: dateRange.from,
      to: dateRange.to,
    },
  });

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [savingCreate, setSavingCreate] = useState(false);
  /**
   * Identifica el intento de cobro, y se renueva al abrir el formulario. Dos
   * envios con el mismo valor dejan un solo cargo, que es lo que sostiene el
   * guardarrail del servidor.
   */
  const solicitudId = useRef<string>("");
  /**
   * Cierra el envio en el mismo tick. `savingCreate` deshabilita el boton, pero
   * eso no ocurre hasta el siguiente render: una rafaga de clics llega entera
   * antes de que React lo aplique.
   */
  const cobrando = useRef(false);

  /** Abre el formulario de cobro con un intento nuevo. */
  const abrirCobro = () => {
    solicitudId.current = crypto.randomUUID();
    setCreateDialog(true);
  };

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);

  // La lista de clientes solo hace falta con un dialogo abierto.
  // El historial necesita la lista para poner nombre a cada cobro, asi que se
  // carga con la pagina y no solo al abrir un dialogo.
  const { data: clientsPage } = useApi(
    CLIENTS_KEY,
    undefined,
    paginatedSchema(clientSchema)
  );
  const clients: Client[] = clientsPage?.data ?? [];

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [clients]);

  // El resumen del dia se pide al backend, que lo calcula sobre todos los
  // pagos y no solo sobre la pagina visible. El endpoint es exclusivo de
  // OWNER/ADMIN, asi que para recepcion se cae al calculo local aproximado.
  const canReadSummary = canDo(role, "payments_edit");
  const today = toLocalDateKey(new Date());
  const { data: dailySummary } = useApi<DailySummary | null>(
    canReadSummary ? `/payment/payments/daily-summary?date=${today}` : null,
    undefined,
    dailySummarySchema.nullable()
  );

  const summary = useMemo(() => {
    if (dailySummary) {
      return {
        total: dailySummary.total,
        cash: dailySummary.byMethod.CASH ?? 0,
        card: dailySummary.byMethod.CARD ?? 0,
        transfer: dailySummary.byMethod.TRANSFER ?? 0,
        count: dailySummary.count,
      };
    }
    const todayPayments = payments.filter(
      (p) => toLocalDateKey(new Date(p.createdAt)) === today
    );
    const sumBy = (method: string) =>
      todayPayments
        .filter((p) => p.method === method)
        .reduce((s, p) => s + p.amount, 0);
    return {
      total: todayPayments.reduce((sum, p) => sum + p.amount, 0),
      cash: sumBy("CASH"),
      card: sumBy("CARD"),
      transfer: sumBy("TRANSFER"),
      count: todayPayments.length,
    };
  }, [dailySummary, payments, today]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cobrando.current) return;
    cobrando.current = true;
    setSavingCreate(true);
    try {
      await api.post("/payment/payments", {
        clientId: createForm.clientId,
        amount: parseFloat(createForm.amount),
        method: createForm.method,
        reference: createForm.reference || undefined,
        notes: createForm.notes || undefined,
        // Sin canje no se manda el campo: el backend exige al menos un punto.
        puntosUsados: Number(createForm.puntosUsados) || undefined,
        solicitudId: solicitudId.current || undefined,
      });
      setCreateDialog(false);
      setCreateForm(emptyCreateForm);
      await revalidatePrefix(PAYMENTS_KEY);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      cobrando.current = false;
      setSavingCreate(false);
    }
  };

  const openEdit = (p: Payment) => {
    setEditId(p.id);
    setEditForm({
      amount: String(p.amount),
      method: p.method,
      reference: p.reference || "",
      notes: p.notes || "",
    });
    setEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    try {
      await api.patch(`/payment/payments/${editId}`, {
        amount: parseFloat(editForm.amount),
        method: editForm.method,
        reference: editForm.reference || undefined,
        notes: editForm.notes || undefined,
      });
      setEditDialog(false);
      setEditId(null);
      await revalidatePrefix(PAYMENTS_KEY);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pagos</h1>
          <p className="text-muted-foreground">Historial y registro de pagos</p>
        </div>
        {canDo(role, "payments_create") && (
          <Button onClick={abrirCobro}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pago
          </Button>
        )}
      </div>

      <PaymentSummaryCards summary={summary} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Filtrar por método de pago"
        >
          {METHOD_FILTERS.map((m) => (
            <FilterChip
              key={m}
              activo={filterMethod === m}
              onClick={() => setFilterMethod(m)}
            >
              {m === "all" ? "Todos" : METHOD_LABELS[m] || m}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="Filtrar desde"
          />
          <span className="text-muted-foreground">a</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="Filtrar hasta"
          />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : loadError ? (
          <ErrorDeCarga
            error={loadError}
            recurso="los pagos"
            onReintentar={() => recargar()}
          />
        ) : payments.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-muted-foreground p-8 text-center">
              <DollarSign className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-2">No hay pagos registrados</p>
            </CardContent>
          </Card>
        ) : (
          payments.map((p) => (
            <PaymentCard
              key={p.id}
              payment={p}
              canEdit={canDo(role, "payments_edit")}
              onEdit={openEdit}
              clientName={p.clientId ? clientMap[p.clientId] : undefined}
            />
          ))
        )}
      </div>

      <Pagination meta={meta} onPageChange={setPage} itemLabel="pagos" />

      <CreatePaymentDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        form={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        clients={clients ?? []}
        saving={savingCreate}
      />

      <EditPaymentDialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        form={editForm}
        onChange={setEditForm}
        onSubmit={handleUpdate}
        saving={savingEdit}
      />
    </div>
  );
}
