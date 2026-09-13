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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  Plus,
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  ArrowUpCircle,
  X,
  Loader2,
  History,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency, formatDate, formatTimeStamp } from "@/lib/utils";
import { nombreDelMetodo } from "@/lib/metodos-de-pago";
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
  resumenDeSesionesSchema,
  ACTIVE_KEY,
  HISTORY_KEY,
  RESUMEN_DE_SESIONES_KEY,
  type CashSession,
  type CashSummary,
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

/** Tonos del descuadre, compartidos por el arqueo y el historial. */
function clasesDeDescuadre(diferencia: number): string {
  return diferencia < 0
    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : "bg-warning-soft text-warning-soft-foreground";
}

const COLUMNAS_DE_SESIONES: ColumnaDeTabla[] = [
  { label: "Sesión" },
  { label: "Apertura", alineacion: "right", ocultaEnMovil: true },
  { label: "Cierre", alineacion: "right", ocultaEnMovil: true },
  { label: "Descuadre", alineacion: "right" },
];

const COLUMNAS_DE_MOVIMIENTOS: ColumnaDeTabla[] = [
  { label: "Concepto" },
  { label: "Cliente" },
  { label: "Hora", ocultaEnMovil: true },
  { label: "Importe", alineacion: "right" },
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
  /** Pestaña del historial: las cerradas primero, que son casi todas. */
  const [estadoDeSesiones, setEstadoDeSesiones] = useState("cerrada");
  const {
    items: history,
    meta: historyMeta,
    setPage: setHistoryPage,
    mutate: mutateHistory,
  } = usePaginatedList<CashSession>({
    basePath: HISTORY_KEY,
    itemSchema: cashSessionSchema,
    // El filtro lo aplica el servidor.
    params: { estado: estadoDeSesiones },
  });

  // Los contadores salen del servidor, sobre todo el historial.
  const { data: resumenDeSesiones, mutate: mutateResumen } = useApi<{
    abiertas: number;
    cerradas: number;
  }>(RESUMEN_DE_SESIONES_KEY, undefined, resumenDeSesionesSchema);

  const haySesiones =
    (resumenDeSesiones?.abiertas ?? 0) + (resumenDeSesiones?.cerradas ?? 0) > 0;

  const movementsKey = activeSession?.id
    ? `/payment/cash-register/${activeSession.id}/summary`
    : null;
  const { data: summary } = useApi<CashSummary | null>(
    movementsKey,
    undefined,
    cashSummarySchema.nullable()
  );
  const movements = useMemo(() => summary?.movements ?? [], [summary]);
  const arqueo = summary?.summary;
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
      await Promise.all([mutateActive(), mutateHistory(), mutateResumen()]);
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
      await Promise.all([mutateActive(), mutateHistory(), mutateResumen()]);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setClosing(false);
    }
  };

  // El arqueo lo hace el servicio, que es quien sabe que un movimiento con
  // datafono deja rastro para el desglose pero no pone dinero en el cajon:
  // rehacer aqui la suma exige justificar un descuadre que no existe.
  const totalIn = arqueo?.totalIn ?? 0;
  const totalOut = arqueo?.totalOut ?? 0;
  const openingAmt = activeSession?.openingAmount ?? 0;
  const expectedTotal = arqueo?.expectedTotal ?? openingAmt;
  const desglose = useMemo(
    () =>
      Object.entries(arqueo?.porMetodo ?? {})
        .map(([metodo, { entradas }]) => ({ metodo, entradas }))
        .filter((linea) => linea.entradas > 0)
        .sort((a, b) => b.entradas - a.entradas),
    [arqueo]
  );
  // Lo cobrado que no acaba en el cajon: datafono y transferencias.
  const fueraDelCajon = useMemo(() => {
    const porMetodo = arqueo?.porMetodo ?? {};
    const enCajon =
      (porMetodo.CASH?.entradas ?? 0) + (porMetodo.MANUAL?.entradas ?? 0);
    const importe = totalIn - enCajon;
    const medios = Object.entries(porMetodo)
      .filter(
        ([metodo, { entradas }]) =>
          entradas > 0 && metodo !== "CASH" && metodo !== "MANUAL"
      )
      .map(([metodo]) => nombreDelMetodo(metodo));
    return { importe, medios };
  }, [arqueo, totalIn]);

  // Descuadre del arqueo mientras se teclea: negativo falta, positivo sobra.
  const diferenciaCierre =
    closeAmount === "" || Number.isNaN(Number(closeAmount))
      ? null
      : Number(closeAmount) - expectedTotal;
  /** Con descuadre el motivo es obligatorio, aquí y en el servicio. */
  const hayDescuadre = diferenciaCierre !== null && diferenciaCierre !== 0;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Caja</h1>
        <Card className="shadow-flat mt-4 border-0">
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
          <h1 className="text-2xl font-bold">Caja</h1>
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
        <h1 className="text-2xl font-bold">Caja</h1>
        <p className="text-muted-foreground">Gestiona la caja de tu negocio</p>
      </div>

      {!activeSession ? (
        <Card className="shadow-flat border-0">
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="shadow-flat border-0">
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
            <Card className="shadow-flat border-0">
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
            <Card className="shadow-flat border-0">
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
          </div>

          {/* Fuera de la fila y con fondo propio: cuenta solo el efectivo. */}
          <Card className="border-primary/30 bg-primary/5 shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">
                Efectivo esperado en cajón
              </p>
              {/* El esperado se tapa mientras el arqueo esta abierto. */}
              {closeDialog ? (
                <>
                  <p className="text-muted-foreground text-xl font-bold">
                    •••••
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Oculto mientras cuentas el cajón
                  </p>
                </>
              ) : (
                <>
                  <p className="text-primary text-xl font-bold">
                    {formatCurrency(expectedTotal)}
                  </p>
                  {fueraDelCajon.importe > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      De {formatCurrency(totalIn)} cobrados,{" "}
                      {formatCurrency(fueraDelCajon.importe)} no entran al cajón
                      {fueraDelCajon.medios.length > 0 &&
                        ` (${fueraDelCajon.medios.join(", ")})`}
                      .
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {desglose.length > 0 && (
            <Card className="shadow-flat border-0">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">
                  Entradas por medio de cobro
                </p>
                {/* Solo el efectivo esta en el cajon; el resto se cuadra contra
                    el datafono o el banco. Un cobro repartido aporta a dos
                    lineas, que es para lo que se guarda por separado. */}
                {closeDialog ? (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Oculto mientras cuentas el cajón
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {desglose.map(({ metodo, entradas }) => (
                      <li key={metodo} className="flex justify-between gap-2">
                        <span className="text-muted-foreground text-sm">
                          {nombreDelMetodo(metodo)}
                        </span>
                        <span className="text-sm font-medium">
                          {formatCurrency(entradas)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

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

          <Card className="shadow-flat border-0">
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
                <TablaDeRegistros
                  titulo="Movimientos de la caja abierta"
                  columnas={COLUMNAS_DE_MOVIMIENTOS}
                  conAcciones={false}
                >
                  {[...movements].reverse().map((m) => (
                    <FilaDeTabla key={m.id}>
                      <CeldaPrincipal
                        icono={
                          m.type === "IN" ? ArrowUpCircle : ArrowDownCircle
                        }
                        colorDelIcono={m.type === "IN" ? "#157E3C" : "#C81E1E"}
                        titulo={m.concept}
                      />
                      {/* Quien registro cada entrada. */}
                      <CeldaDeTabla apagada>{m.clientName || "—"}</CeldaDeTabla>
                      <CeldaDeTabla apagada ocultaEnMovil>
                        <span className="whitespace-nowrap">
                          {formatTimeStamp(m.createdAt)}
                        </span>
                      </CeldaDeTabla>
                      <CeldaDeTabla
                        alineacion="right"
                        className={
                          m.type === "IN"
                            ? "text-success font-semibold"
                            : "text-destructive font-semibold"
                        }
                      >
                        {m.type === "IN" ? "+" : "-"}
                        {formatCurrency(m.amount)}
                      </CeldaDeTabla>
                    </FilaDeTabla>
                  ))}
                </TablaDeRegistros>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {haySesiones && (
        <Card className="shadow-flat mt-6 border-0">
          <CardHeader className="gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" /> Historial de sesiones
            </CardTitle>
            <Tabs
              value={estadoDeSesiones}
              onValueChange={(v) => {
                setEstadoDeSesiones(v);
                setHistoryPage(1);
              }}
            >
              <TabsList>
                <TabsTrigger value="cerrada">
                  Cerradas ({resumenDeSesiones?.cerradas ?? 0})
                </TabsTrigger>
                <TabsTrigger value="abierta">
                  Abiertas ({resumenDeSesiones?.abiertas ?? 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {estadoDeSesiones === "abierta"
                  ? "No hay ninguna caja abierta ahora mismo."
                  : "Todavía no se ha cerrado ninguna caja."}
              </p>
            ) : (
              <TablaDeRegistros
                titulo="Historial de sesiones de caja"
                columnas={COLUMNAS_DE_SESIONES}
                conAcciones={false}
              >
                {history.map((s) => (
                  <FilaDeTabla key={s.id}>
                    <CeldaPrincipal
                      icono={History}
                      titulo={`${formatDate(s.openedAt)} – ${
                        s.closedAt ? formatDate(s.closedAt) : "En curso"
                      }`}
                      subtitulo={s.notes || undefined}
                    />
                    <CeldaDeTabla alineacion="right" apagada ocultaEnMovil>
                      {formatCurrency(s.openingAmount)}
                    </CeldaDeTabla>
                    <CeldaDeTabla alineacion="right" apagada ocultaEnMovil>
                      {s.closingAmount != null
                        ? formatCurrency(s.closingAmount)
                        : "—"}
                    </CeldaDeTabla>
                    {/* El descuadre de cada sesion. */}
                    <CeldaDeTabla alineacion="right">
                      {s.difference ? (
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-base font-semibold ${clasesDeDescuadre(s.difference)}`}
                        >
                          {/* El icono lleva el signo: si falta o si sobra. */}
                          {s.difference < 0 ? (
                            <ArrowDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ArrowUp className="h-4 w-4" aria-hidden />
                          )}
                          {s.difference < 0 ? "Faltaron " : "Sobraron "}
                          {formatCurrency(Math.abs(s.difference))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </CeldaDeTabla>
                  </FilaDeTabla>
                ))}
              </TablaDeRegistros>
            )}
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
        descripcion="Cuenta el dinero con el que arranca el turno."
        icono={Wallet}
        pie={
          <>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOpen} disabled={opening}>
              {opening ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="mr-2 h-4 w-4" />
              )}
              Abrir caja
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Monto inicial (COP)"
            hint="Dejar en 0 si la caja arranca vacía"
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
        </div>
      </Dialog>

      <Dialog
        open={movementDialog}
        onClose={() => setMovementDialog(false)}
        title="Registrar movimiento"
        descripcion="Una entrada o una salida de dinero del cajón."
        icono={DollarSign}
        pie={
          <>
            <Button variant="outline" onClick={() => setMovementDialog(false)}>
              Cancelar
            </Button>
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
          </>
        }
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
        </div>
      </Dialog>

      <Dialog
        open={closeDialog}
        onClose={() => setCloseDialog(false)}
        title="Cerrar caja"
        descripcion="Arqueo del turno: cuenta el cajón y cierra la sesión."
        icono={X}
        pie={
          <>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>
              Cancelar
            </Button>
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
          </>
        }
      >
        <div className="space-y-4">
          {/* El total esperado no se enseña hasta que el cajero escribe su conteo. */}
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
                Efectivo esperado en cajón
              </p>
              <p className="text-xl font-bold">
                {formatCurrency(expectedTotal)}
              </p>
            </div>
          )}
          {diferenciaCierre !== null && diferenciaCierre !== 0 && (
            <div
              className={`rounded-lg p-3 text-sm ${clasesDeDescuadre(diferenciaCierre)}`}
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
        </div>
      </Dialog>
    </div>
  );
}
