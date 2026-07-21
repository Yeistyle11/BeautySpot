"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";

interface CashSession {
  id: string;
  openingAmount: string;
  closingAmount?: string;
  openedAt: string;
  closedAt?: string;
  notes?: string;
  isOpen?: boolean;
}

interface CashMovement {
  id: string;
  type: "IN" | "OUT";
  amount: string;
  concept: string;
  registeredAt: string;
}

const movementTypeOptions = [
  {
    value: "IN",
    label: "Entrada",
    icon: <ArrowUpCircle className="h-5 w-5 text-green-600" />,
  },
  {
    value: "OUT",
    label: "Salida",
    icon: <ArrowDownCircle className="h-5 w-5 text-red-600" />,
  },
];

export default function CashRegisterPage() {
  const { role } = useAuthStore();
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadActive = async () => {
    try {
      const session = await api.get<CashSession>(
        "/payment/cash-register/active"
      );
      setActiveSession(session);
      if (session?.id) {
        const summary = await api.get<{ movements: CashMovement[] }>(
          `/payment/cash-register/${session.id}/summary`
        );
        if (summary?.movements) setMovements(summary.movements);
      }
    } catch {
      setActiveSession(null);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = () => {
    api
      .get<CashSession[]>("/payment/cash-register/history")
      .then(setHistory)
      .catch(() => {});
  };

  useEffect(() => {
    loadActive();
    loadHistory();
  }, []);

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
      loadActive();
    } catch (err) {
      console.error(err);
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
      loadActive();
    } catch (err) {
      console.error(err);
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
      setActiveSession(null);
      loadActive();
      loadHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setClosing(false);
    }
  };

  const totalIn = movements
    .filter((m) => m.type === "IN")
    .reduce((s, m) => s + parseFloat(m.amount), 0);
  const totalOut = movements
    .filter((m) => m.type === "OUT")
    .reduce((s, m) => s + parseFloat(m.amount), 0);
  const openingAmt = parseFloat(activeSession?.openingAmount || "0");
  const expectedTotal = openingAmt + totalIn - totalOut;

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
          {/* Session summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">Monto inicial</p>
                <p className="text-xl font-bold">
                  {formatCurrency(openingAmt)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {new Date(activeSession.openedAt).toLocaleString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-muted-foreground text-xs">Entradas</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(totalIn)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-muted-foreground text-xs">Salidas</p>
                  <p className="text-xl font-bold text-red-600">
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

          {/* Actions */}
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

          {/* Movements list */}
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
                          <ArrowUpCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{m.concept}</p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(m.registeredAt).toLocaleString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${m.type === "IN" ? "text-green-600" : "text-red-600"}`}
                      >
                        {m.type === "IN" ? "+" : "-"}
                        {formatCurrency(parseFloat(m.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session history */}
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
                      {new Date(s.openedAt).toLocaleDateString("es-CO")} -{" "}
                      {s.closedAt
                        ? new Date(s.closedAt).toLocaleDateString("es-CO")
                        : "En curso"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Apertura: {formatCurrency(parseFloat(s.openingAmount))}
                      {s.closingAmount &&
                        ` · Cierre: ${formatCurrency(parseFloat(s.closingAmount))}`}
                    </p>
                  </div>
                  <Badge variant={s.closedAt ? "secondary" : "success"}>
                    {s.closedAt ? "Cerrada" : "Abierta"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title="Abrir caja"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Monto inicial (COP)</Label>
            <Input
              type="number"
              placeholder="50000"
              value={openAmount}
              onChange={(e) => setOpenAmount(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Dejar en 0 si la caja arranca vacia
            </p>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={openNotes}
              onChange={(e) => setOpenNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones..."
            />
          </div>
          <Button onClick={handleOpen} disabled={opening}>
            {opening ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="mr-2 h-4 w-4" />
            )}
            Abrir caja
          </Button>
        </div>
      </Dialog>

      {/* Movement dialog */}
      <Dialog
        open={movementDialog}
        onClose={() => setMovementDialog(false)}
        title="Registrar movimiento"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <RadioGroup
              options={movementTypeOptions}
              value={moveType}
              onChange={setMoveType}
            />
          </div>
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input
              type="number"
              placeholder="10000"
              value={moveAmount}
              onChange={(e) => setMoveAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Concepto</Label>
            <Input
              placeholder="Ej: Pago de proveedor, Venta de producto..."
              value={moveConcept}
              onChange={(e) => setMoveConcept(e.target.value)}
              required
            />
          </div>
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

      {/* Close dialog */}
      <Dialog
        open={closeDialog}
        onClose={() => setCloseDialog(false)}
        title="Cerrar caja"
      >
        <div className="space-y-4">
          <div className="bg-muted/50 space-y-1 rounded-lg p-4">
            <p className="text-muted-foreground text-sm">
              Total esperado en caja
            </p>
            <p className="text-xl font-bold">{formatCurrency(expectedTotal)}</p>
          </div>
          <div className="space-y-2">
            <Label>Monto final en caja (COP)</Label>
            <Input
              type="number"
              placeholder={String(expectedTotal)}
              value={closeAmount}
              onChange={(e) => setCloseAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              rows={2}
              placeholder="Diferencias, observaciones..."
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={closing || !closeAmount}
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
