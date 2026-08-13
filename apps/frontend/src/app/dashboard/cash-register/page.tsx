"use client";

// Pagina de caja: apertura, cierre y movimientos de la sesion de caja del dia.
import { useMemo, useState } from "react";
import { mutate } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  Loader2,
  History,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatTimeStamp } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { Pagination } from "@/components/ui/pagination";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import {
  cashSessionSchema,
  cashSummarySchema,
  ACTIVE_KEY,
  HISTORY_KEY,
  type CashSession,
  type CashMovement,
} from "./schemas";

const movementTypeOptions = [
  {
    value: "IN",
    label: "Entrada",
    icon: <ArrowUpCircle className="text-success h-5 w-5" />,
  },
  {
    value: "OUT",
    label: "Salida",
    icon: <ArrowDownCircle className="text-destructive h-5 w-5" />,
  },
];

export default function CashRegisterPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const {
    data: activeSession,
    isLoading: loadingActive,
    error: errorActive,
    mutate: mutateActive,
  } = useApi<CashSession | null>(
    ACTIVE_KEY,
    undefined,
    cashSessionSchema.nullable()
  );
  const {
    items: history,
    meta: historyMeta,
    setPage: setHistoryPage,
    mutate: mutateHistory,
  } = usePaginatedList<CashSession>({
    basePath: HISTORY_KEY,
    itemSchema: cashSessionSchema,
  });

  const movementsKey = activeSession?.id
    ? `/payment/cash-register/${activeSession.id}/summary`
    : null;
  const { data: summary } = useApi<{ movements: CashMovement[] } | null>(
    movementsKey,
    undefined,
    cashSummarySchema.nullable()
  );
  const movements = useMemo(() => summary?.movements ?? [], [summary]);
  const loading = loadingActive;

  const [openDialog, setOpenDialog] = useState(false);
  const [openAmount, setOpenAmount] = useState("");
  const [openNotes, setOpenNotes] = useState("");
  const [opening, setOpening] = useState(false);

  const [movementDialog, setMovementDialog] = useState(false);
  const [moveType, setMoveType] = useState("IN");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveConcept, setMoveConcept] = useState("");
  const [registering, setRegistering] = useState(false);

  const [closeDialog, setCloseDialog] = useState(false);
  const [closeAmount, setCloseAmount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closing, setClosing] = useState(false);

  const handleOpen = async () => {
    setOpening(true);
    try {
      await api.post("/payment/cash-register/open", {
        openingAmount: openAmount ? parseFloat(openAmount) : 0,
        notes: openNotes || undefined,
      });
      setOpenDialog(false);
      setOpenAmount("");
      setOpenNotes("");
      await mutateActive();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setOpening(false);
    }
  };

  const handleMovement = async () => {
    if (!activeSession) return;
    setRegistering(true);
    try {
      await api.post(`/payment/cash-register/${activeSession.id}/movements`, {
        type: moveType,
        amount: parseFloat(moveAmount),
        concept: moveConcept,
      });
      setMovementDialog(false);
      setMoveAmount("");
      setMoveConcept("");
      await mutate(movementsKey);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setRegistering(false);
    }
  };

  const handleClose = async () => {
    if (!activeSession) return;
    setClosing(true);
    try {
      await api.post(`/payment/cash-register/${activeSession.id}/close`, {
        closingAmount: parseFloat(closeAmount),
        notes: closeNotes || undefined,
      });
      setCloseDialog(false);
      setCloseAmount("");
      setCloseNotes("");
      await Promise.all([mutateActive(), mutateHistory()]);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setClosing(false);
    }
  };

  const { totalIn, totalOut } = useMemo(
    () =>
      movements.reduce(
        (acc, m) => {
          if (m.type === "IN") acc.totalIn += m.amount;
          else acc.totalOut += m.amount;
          return acc;
        },
        { totalIn: 0, totalOut: 0 }
      ),
    [movements]
  );
  const openingAmt = activeSession?.openingAmount ?? 0;
  const expectedTotal = openingAmt + totalIn - totalOut;
  // Descuadre del arqueo mientras se teclea: negativo falta, positivo sobra.
  const diferenciaCierre =
    closeAmount === "" || Number.isNaN(Number(closeAmount))
      ? null
      : Number(closeAmount) - expectedTotal;
  /** Con descuadre, el motivo deja de ser opcional: lo exige también el backend. */
  const hayDescuadre = diferenciaCierre !== null && diferenciaCierre !== 0;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Caja Registradora</h1>
        <Card className="mt-4 border-0 shadow-sm">
          <CardContent className="text-muted-foreground p-8 text-center">
            Cargando...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorActive) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Caja Registradora</h1>
          <p className="text-muted-foreground">
            Gestiona la caja de tu negocio
          </p>
        </div>
        <ErrorDeCarga
          error={errorActive}
          recurso="los datos de la caja"
          onReintentar={() => mutateActive()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Caja Registradora</h1>
        <p className="text-muted-foreground">Gestiona la caja de tu negocio</p>
      </div>

      {!activeSession ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-4 p-8 text-center">
            <Wallet className="text-muted-foreground mx-auto h-16 w-16 opacity-30" />
            <div>
              <h3 className="text-lg font-medium">Caja cerrada</h3>
              <p className="text-muted-foreground text-sm">
                Abre la caja para empezar a registrar movimientos
              </p>
            </div>
            <Button onClick={() => setOpenDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Abrir caja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">Monto inicial</p>
                <p className="text-xl font-bold">
                  {formatCurrency(openingAmt)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatTimeStamp(activeSession.openedAt)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <TrendingUp className="text-success h-8 w-8" />
                <div>
                  <p className="text-muted-foreground text-xs">Entradas</p>
                  <p className="text-success text-xl font-bold">
                    {formatCurrency(totalIn)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <TrendingDown className="text-destructive h-8 w-8" />
                <div>
                  <p className="text-muted-foreground text-xs">Salidas</p>
                  <p className="text-destructive text-xl font-bold">
                    {formatCurrency(totalOut)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">Total esperado</p>
                <p className="text-primary text-xl font-bold">
                  {formatCurrency(expectedTotal)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setMovementDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Registrar movimiento
            </Button>
            {canDo(role, "cash_register_close") && (
              <Button
                variant="destructive"
                onClick={() => setCloseDialog(true)}
              >
                <X className="mr-2 h-4 w-4" /> Cerrar caja
              </Button>
            )}
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                Movimientos ({movements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No hay movimientos registrados
                </p>
              ) : (
                <div className="space-y-2">
                  {[...movements].reverse().map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {m.type === "IN" ? (
                          <ArrowUpCircle className="text-success h-5 w-5" />
                        ) : (
                          <ArrowDownCircle className="text-destructive h-5 w-5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{m.concept}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatTimeStamp(m.createdAt)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${m.type === "IN" ? "text-success" : "text-destructive"}`}
                      >
                        {m.type === "IN" ? "+" : "-"}
                        {formatCurrency(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {history.length > 0 && (
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" /> Historial de sesiones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(s.openedAt)} -{" "}
                      {s.closedAt ? formatDate(s.closedAt) : "En curso"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Apertura: {formatCurrency(s.openingAmount)}
                      {s.closingAmount != null &&
                        ` · Cierre: ${formatCurrency(s.closingAmount)}`}
                    </p>
                    {/*
                      El descuadre se ve en la lista, no restando sesión a
                      sesión: un sobrante sin explicar tiene que saltar a la
                      vista de quien repase la semana.
                    */}
                    {!!s.difference && (
                      <p
                        className={
                          s.difference < 0
                            ? "text-destructive mt-1 text-xs font-medium"
                            : "text-warning mt-1 text-xs font-medium"
                        }
                      >
                        {s.difference < 0 ? "Faltaron " : "Sobraron "}
                        {formatCurrency(Math.abs(s.difference))}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </p>
                    )}
                  </div>
                  <Badge variant={s.closedAt ? "secondary" : "success"}>
                    {s.closedAt ? "Cerrada" : "Abierta"}
                  </Badge>
                </div>
              ))}
            </div>
            <Pagination
              meta={historyMeta}
              onPageChange={setHistoryPage}
              itemLabel="sesiones"
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title="Abrir caja"
      >
        <div className="space-y-4">
          <Field
            label="Monto inicial (COP)"
            hint="Dejar en 0 si la caja arranca vacia"
          >
            <Input
              type="number"
              min={0}
              placeholder="50000"
              value={openAmount}
              onChange={(e) => setOpenAmount(e.target.value)}
            />
          </Field>
          <Field label="Notas (opcional)">
            <Textarea
              value={openNotes}
              onChange={(e) => setOpenNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones..."
            />
          </Field>
          <div className="flex gap-3">
            <Button onClick={handleOpen} disabled={opening}>
              {opening ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="mr-2 h-4 w-4" />
              )}
              Abrir caja
            </Button>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={movementDialog}
        onClose={() => setMovementDialog(false)}
        title="Registrar movimiento"
      >
        <div className="space-y-4">
          <Field label="Tipo de movimiento">
            <RadioGroup
              options={movementTypeOptions}
              value={moveType}
              onChange={setMoveType}
              label="Tipo de movimiento"
            />
          </Field>
          <Field label="Monto (COP)">
            <Input
              type="number"
              min={0}
              placeholder="10000"
              value={moveAmount}
              onChange={(e) => setMoveAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Concepto">
            <Input
              placeholder="Ej: Pago de proveedor, Venta de producto..."
              value={moveConcept}
              onChange={(e) => setMoveConcept(e.target.value)}
              required
            />
          </Field>
          <Button
            onClick={handleMovement}
            disabled={registering || !moveAmount || !moveConcept}
          >
            {registering ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="mr-2 h-4 w-4" />
            )}
            Registrar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={closeDialog}
        onClose={() => setCloseDialog(false)}
        title="Cerrar caja"
      >
        <div className="space-y-4">
          {/*
            Conteo a ciegas: el total esperado no se enseña hasta que el cajero
            ha escrito lo que contó. Verlo antes convierte el arqueo en copiar
            una cifra, y un cierre que siempre cuadra no prueba nada.
          */}
          <Field
            label="Monto final en caja (COP)"
            hint="Cuenta el dinero del cajón y escribe lo que haya"
          >
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={closeAmount}
              onChange={(e) => setCloseAmount(e.target.value)}
              required
            />
          </Field>
          {diferenciaCierre !== null && (
            <div className="bg-muted/50 space-y-1 rounded-lg p-4">
              <p className="text-muted-foreground text-sm">
                Total esperado en caja
              </p>
              <p className="text-xl font-bold">
                {formatCurrency(expectedTotal)}
              </p>
            </div>
          )}
          {diferenciaCierre !== null && diferenciaCierre !== 0 && (
            <div
              className={
                diferenciaCierre < 0
                  ? "rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              }
            >
              {diferenciaCierre < 0 ? "Faltan " : "Sobran "}
              <strong>{formatCurrency(Math.abs(diferenciaCierre))}</strong>{" "}
              respecto al total esperado. Anota el motivo para poder cerrar.
            </div>
          )}
          <Field
            label={hayDescuadre ? "Motivo del descuadre" : "Notas (opcional)"}
          >
            <Textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              rows={2}
              placeholder={
                hayDescuadre
                  ? "Por qué no cuadra..."
                  : "Diferencias, observaciones..."
              }
              required={hayDescuadre}
            />
          </Field>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={
              closing || !closeAmount || (hayDescuadre && !closeNotes.trim())
            }
          >
            {closing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            Cerrar caja
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
