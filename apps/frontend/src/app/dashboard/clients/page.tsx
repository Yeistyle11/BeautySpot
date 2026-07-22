"use client";
import { useState, useMemo, useDeferredValue } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Search, Phone, Mail, Award, Calendar, Edit } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { logger } from "@/lib/logger";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  loyaltyPoints: number;
  notes: string | null;
  active: boolean;
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: string;
  appointmentServices: { serviceName: string }[];
}

const emptyForm = { name: "", email: "", phone: "" };

const CLIENTS_KEY = "/core/clients";

export default function ClientsPage() {
  const { role } = useAuthStore();
  const {
    items: clients,
    isLoading: loading,
    create: createClient,
    update: updateClient,
  } = useCrudResource<Client>({
    listKey: CLIENTS_KEY,
    basePath: "/core/clients",
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await createClient({
        name: createForm.name,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
      });
      setCreateForm(emptyForm);
      setCreateDialog(false);
    } catch (err) {
      logger.error(err);
    } finally {
      setSavingCreate(false);
    }
  };

  const openDetail = (client: Client) => {
    setSelectedClient(client);
  };

  const openEdit = (client: Client) => {
    setEditId(client.id);
    setEditForm({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      notes: client.notes || "",
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
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [clients, deferredSearch]);

  const statusLabels: Record<string, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmada",
    COMPLETED: "Completada",
    CANCELLED: "Cancelada",
    NO_SHOW: "No asistio",
  };

  const detailKey = selectedClient
    ? `/booking/appointments?clientId=${selectedClient.id}`
    : null;
  const { data: clientAppointments, isLoading: loadingDetail } =
    useApi<Appointment[]>(detailKey);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Administra tu cartera de clientes
          </p>
        </div>
        {canDo(role, "clients_create") && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : (
          filtered.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer border-0 shadow-sm transition-shadow [contain-intrinsic-size:auto_140px] [content-visibility:auto] hover:shadow-md"
              onClick={() => openDetail(c)}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-blue-50 font-bold text-blue-600">
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
                  <div className="mt-3 flex items-center gap-1.5 text-sm text-amber-600">
                    <Award className="h-4 w-4" />
                    {c.loyaltyPoints} puntos
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        title="Nuevo cliente"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              placeholder="Maria Garcia"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="maria@email.com"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                placeholder="+57 300 1234567"
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, phone: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={savingCreate}>
              {savingCreate ? "Guardando..." : "Crear cliente"}
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
                  <AvatarFallback className="bg-blue-50 text-2xl font-bold text-blue-600">
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
                {canDo(role, "clients_edit") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(selectedClient)}
                  >
                    <Edit className="mr-1 h-3 w-3" /> Editar
                  </Button>
                )}
              </div>
            </div>

            {selectedClient.loyaltyPoints > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3">
                <Award className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-700">
                  {selectedClient.loyaltyPoints} puntos de fidelidad
                </span>
              </div>
            )}

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4" /> Historial de citas
              </h4>
              {loadingDetail ? (
                <p className="text-muted-foreground text-sm">Cargando...</p>
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
                          {formatCurrency(parseFloat(a.totalAmount))}
                        </span>
                        <Badge
                          variant={
                            a.status === "COMPLETED"
                              ? "success"
                              : a.status === "CANCELLED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {statusLabels[a.status] || a.status}
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

      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        title="Editar cliente"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={editForm.notes}
              onChange={(e) =>
                setEditForm({ ...editForm, notes: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="flex gap-3">
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
