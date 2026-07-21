"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import {
  Scissors,
  Plus,
  DollarSign,
  Clock,
  Edit,
  Trash2,
  Tag,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  category: string | null;
  categoryId: string | null;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
}

const emptyForm = {
  name: "",
  description: "",
  price: "",
  duration: "30",
  category: "",
  categoryId: "",
  active: true,
};

export default function ServicesPage() {
  const { role } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => {
    api
      .get<Service[]>("/core/services")
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false));
    api
      .get<Category[]>("/core/service-categories")
      .then(setCategories)
      .catch(console.error);
  };
  useEffect(load, []);

  const categoryNames = useMemo(() => {
    const backendCats = categories.filter((c) => c.active).map((c) => c.name);
    const serviceCats = Array.from(
      new Set(services.map((s) => s.category).filter(Boolean) as string[])
    );
    const all = Array.from(new Set([...backendCats, ...serviceCats])).sort();
    return all;
  }, [categories, services]);

  const filtered = useMemo(() => {
    if (filterCategory === "all") return services;
    return services.filter((s) => s.category === filterCategory);
  }, [services, filterCategory]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await api.post("/core/services", {
        name: createForm.name,
        description: createForm.description || undefined,
        price: Number(createForm.price),
        duration: Number(createForm.duration),
        category: createForm.categoryId
          ? categories.find((c) => c.id === createForm.categoryId)?.name ||
            createForm.category ||
            undefined
          : createForm.category || undefined,
        categoryId: createForm.categoryId || undefined,
      });
      setCreateForm(emptyForm);
      setCreateDialog(false);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCreate(false);
    }
  };

  const openEdit = (s: Service) => {
    setEditId(s.id);
    setEditForm({
      name: s.name,
      description: s.description || "",
      price: String(s.price),
      duration: String(s.duration),
      category: s.category || "",
      categoryId: s.categoryId || "",
      active: s.active,
    });
    setEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    try {
      await api.patch(`/core/services/${editId}`, {
        name: editForm.name,
        description: editForm.description || undefined,
        price: Number(editForm.price),
        duration: Number(editForm.duration),
        category: editForm.categoryId
          ? categories.find((c) => c.id === editForm.categoryId)?.name ||
            editForm.category ||
            undefined
          : editForm.category || undefined,
        categoryId: editForm.categoryId || undefined,
        active: editForm.active,
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

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este servicio?")) return;
    try {
      await api.delete(`/core/services/${id}`);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="text-muted-foreground">
            Administra los servicios de tu negocio
          </p>
        </div>
        {canDo(role, "services_create") && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo servicio
          </Button>
        )}
      </div>

      {categoryNames.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Tag className="text-muted-foreground h-4 w-4" />
          <button
            onClick={() => setFilterCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-primary/20"
            }`}
          >
            Todos ({services.length})
          </button>
          {categoryNames.map((cat) => {
            const count = services.filter((s) => s.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/20"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : (
          filtered.map((s) => (
            <Card
              key={s.id}
              className={`border-0 shadow-sm transition-shadow hover:shadow-md ${!s.active ? "opacity-60" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                      <Scissors className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      {s.category && (
                        <Badge variant="secondary" className="mt-1">
                          {s.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canDo(role, "services_edit") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                      >
                        <Edit className="text-muted-foreground h-4 w-4" />
                      </Button>
                    )}
                    {canDo(role, "services_delete") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="text-muted-foreground h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {s.description && (
                  <p className="text-muted-foreground mt-2 text-sm">
                    {s.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="text-primary flex items-center gap-1 font-semibold">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(s.price)}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {s.duration} min
                  </span>
                  {!s.active && (
                    <Badge variant="secondary" className="text-xs">
                      Inactivo
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        title="Nuevo servicio"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              placeholder="Corte clasico"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Precio (COP)</Label>
              <Input
                type="number"
                placeholder="25000"
                value={createForm.price}
                onChange={(e) =>
                  setCreateForm({ ...createForm, price: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Duracion (min)</Label>
              <Input
                type="number"
                placeholder="30"
                value={createForm.duration}
                onChange={(e) =>
                  setCreateForm({ ...createForm, duration: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
              value={createForm.categoryId}
              onChange={(e) =>
                setCreateForm({ ...createForm, categoryId: e.target.value })
              }
            >
              <option value="">Sin categoría</option>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Textarea
              placeholder="Descripcion del servicio"
              value={createForm.description}
              onChange={(e) =>
                setCreateForm({ ...createForm, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={savingCreate}>
              {savingCreate ? "Guardando..." : "Crear servicio"}
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
        title="Editar servicio"
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
              <Label>Precio (COP)</Label>
              <Input
                type="number"
                value={editForm.price}
                onChange={(e) =>
                  setEditForm({ ...editForm, price: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Duracion (min)</Label>
              <Input
                type="number"
                value={editForm.duration}
                onChange={(e) =>
                  setEditForm({ ...editForm, duration: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
              value={editForm.categoryId}
              onChange={(e) =>
                setEditForm({ ...editForm, categoryId: e.target.value })
              }
            >
              <option value="">Sin categoría</option>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Textarea
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={editForm.active}
              onCheckedChange={(checked) =>
                setEditForm({ ...editForm, active: checked })
              }
            />
            <Label>
              {editForm.active ? "Servicio activo" : "Servicio inactivo"}
            </Label>
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
