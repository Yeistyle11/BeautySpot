"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { Dialog } from "@/components/ui/dialog";
import {
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  Plus,
  Wallet,
  Calendar,
  Edit,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";

interface Payment {
  id: string;
  amount: string;
  method: string;
  status: string;
  registeredAt: string;
  appointmentId?: string;
  clientId?: string;
  reference?: string;
  notes?: string;
}

interface Client {
  id: string;
  name: string;
}

const methodIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = { CASH: Banknote, CARD: CreditCard, TRANSFER: Smartphone };
const methodLabels: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

const paymentMethodOptions = [
  { value: "CASH", label: "Efectivo", icon: <Banknote className="h-5 w-5" /> },
  {
    value: "CARD",
    label: "Datáfono",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    value: "TRANSFER",
    label: "Transferencia",
    icon: <Smartphone className="h-5 w-5" />,
  },
];

const emptyCreateForm = {
  clientId: "",
  amount: "",
  method: "CASH",
  reference: "",
  notes: "",
};
const emptyEditForm = { amount: "", method: "", reference: "", notes: "" };

export default function PaymentsPage() {
  const { role } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [createDialog, setCreateDialog] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => {
    api
      .get<Payment[]>("/payment/payments")
      .then(setPayments)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (createDialog || editDialog) {
      api
        .get<Client[]>("/core/clients")
        .then(setClients)
        .catch(() => {});
    }
  }, [createDialog, editDialog]);

  const filtered = useMemo(() => {
    let result = payments;
    if (filterMethod !== "all")
      result = result.filter((p) => p.method === filterMethod);
    if (dateFrom)
      result = result.filter(
        (p) => new Date(p.registeredAt) >= new Date(dateFrom)
      );
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      result = result.filter((p) => new Date(p.registeredAt) <= to);
    }
    return result;
  }, [payments, filterMethod, dateFrom, dateTo]);

  const todayPayments = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return payments.filter((p) => p.registeredAt?.startsWith(today));
  }, [payments]);

  const summary = useMemo(() => {
    const total = todayPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );
    const cash = todayPayments
      .filter((p) => p.method === "CASH")
      .reduce((s, p) => s + parseFloat(p.amount), 0);
    const card = todayPayments
      .filter((p) => p.method === "CARD")
      .reduce((s, p) => s + parseFloat(p.amount), 0);
    const transfer = todayPayments
      .filter((p) => p.method === "TRANSFER")
      .reduce((s, p) => s + parseFloat(p.amount), 0);
    return { total, cash, card, transfer, count: todayPayments.length };
  }, [todayPayments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await api.post("/payment/payments", {
        clientId: createForm.clientId || undefined,
        amount: parseFloat(createForm.amount),
        method: createForm.method,
        reference: createForm.reference || undefined,
        notes: createForm.notes || undefined,
      });
      setCreateDialog(false);
      setCreateForm(emptyCreateForm);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCreate(false);
    }
  };

  const openEdit = (p: Payment) => {
    setEditId(p.id);
    setEditForm({
      amount: p.amount,
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
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagos</h1>
          <p className="text-muted-foreground">Historial y registro de pagos</p>
        </div>
        {canDo(role, "payments_create") && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pago
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total hoy</p>
              <p className="text-lg font-bold">
                {formatCurrency(summary.total)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Banknote className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Efectivo</p>
              <p className="text-lg font-bold">
                {formatCurrency(summary.cash)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tarjeta</p>
              <p className="text-lg font-bold">
                {formatCurrency(summary.card)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Smartphone className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Transferencia</p>
              <p className="text-lg font-bold">
                {formatCurrency(summary.transfer)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {["all", "CASH", "CARD", "TRANSFER"].map((m) => (
            <button
              key={m}
              onClick={() => setFilterMethod(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterMethod === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20"}`}
            >
              {m === "all" ? "Todos" : methodLabels[m] || m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="text-muted-foreground">a</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-muted-foreground p-8 text-center">
              <DollarSign className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-2">No hay pagos registrados</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((p) => {
            const Icon = methodIcons[p.method] || DollarSign;
            return (
              <Card
                key={p.id}
                className="border-0 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                        <Icon className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {formatCurrency(parseFloat(p.amount))}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <span>
                            {new Date(p.registeredAt).toLocaleDateString(
                              "es-CO",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                          {p.appointmentId && (
                            <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                              Cita: {p.appointmentId.slice(0, 8)}...
                            </span>
                          )}
                          {p.reference && (
                            <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                              Ref: {p.reference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canDo(role, "payments_edit") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                        >
                          <Edit className="text-muted-foreground h-4 w-4" />
                        </Button>
                      )}
                      <Badge variant="secondary">
                        {methodLabels[p.method] || p.method}
                      </Badge>
                      <Badge
                        variant={
                          p.status === "COMPLETED" ? "success" : "secondary"
                        }
                      >
                        {p.status === "COMPLETED" ? "Completado" : p.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        title="Registrar pago"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              value={createForm.clientId}
              onChange={(e) =>
                setCreateForm({ ...createForm, clientId: e.target.value })
              }
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input
              type="number"
              placeholder="25000"
              value={createForm.amount}
              onChange={(e) =>
                setCreateForm({ ...createForm, amount: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Metodo de pago</Label>
            <RadioGroup
              options={paymentMethodOptions}
              value={createForm.method}
              onChange={(v) => setCreateForm({ ...createForm, method: v })}
            />
          </div>
          {createForm.method === "TRANSFER" && (
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                placeholder="#123456789"
                value={createForm.reference}
                onChange={(e) =>
                  setCreateForm({ ...createForm, reference: e.target.value })
                }
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas sobre el pago..."
              value={createForm.notes}
              onChange={(e) =>
                setCreateForm({ ...createForm, notes: e.target.value })
              }
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={savingCreate}>
              {savingCreate ? "Guardando..." : "Registrar pago"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialog(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        title="Editar pago"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input
              type="number"
              value={editForm.amount}
              onChange={(e) =>
                setEditForm({ ...editForm, amount: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Metodo de pago</Label>
            <RadioGroup
              options={paymentMethodOptions}
              value={editForm.method}
              onChange={(v) => setEditForm({ ...editForm, method: v })}
            />
          </div>
          {editForm.method === "TRANSFER" && (
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                placeholder="#123456789"
                value={editForm.reference}
                onChange={(e) =>
                  setEditForm({ ...editForm, reference: e.target.value })
                }
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas sobre el pago..."
              value={editForm.notes}
              onChange={(e) =>
                setEditForm({ ...editForm, notes: e.target.value })
              }
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={savingEdit}>
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialog(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
