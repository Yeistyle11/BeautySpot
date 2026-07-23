"use client";
import { useState, useMemo } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Scissors,
  Plus,
  DollarSign,
  Clock,
  Edit,
  Trash2,
  Tag,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";

const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  duration: z.number(),
  category: z.string().nullable(),
  categoryId: z.string().nullable(),
  active: z.boolean(),
});
type Service = z.infer<typeof serviceSchema>;

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  active: z.boolean(),
});
type Category = z.infer<typeof categorySchema>;

const emptyForm = {
  name: "",
  description: "",
  price: "",
  duration: "30",
  category: "",
  categoryId: "",
  active: true,
};

const SERVICES_KEY = "/core/services";
const CATEGORIES_KEY = "/core/service-categories";

export default function ServicesPage() {
  const { role } = useAuthStore();
  const {
    items: services,
    isLoading: loading,
    create: createService,
    update: updateService,
    remove: removeService,
  } = useCrudResource<Service>({
    listKey: SERVICES_KEY,
    basePath: "/core/services",
    schema: z.array(serviceSchema),
  });
  const { data: categories } = useApi<Category[]>(
    CATEGORIES_KEY,
    undefined,
    z.array(categorySchema)
  );
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const categoryNames = useMemo(() => {
    const backendCats = (categories ?? [])
      .filter((c) => c.active)
      .map((c) => c.name);
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

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of services) {
      if (!s.category) continue;
      counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    }
    return counts;
  }, [services]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await createService({
        name: createForm.name,
        description: createForm.description || undefined,
        price: Number(createForm.price),
        duration: Number(createForm.duration),
        category: createForm.categoryId
          ? (categories ?? []).find((c) => c.id === createForm.categoryId)
              ?.name ||
            createForm.category ||
            undefined
          : createForm.category || undefined,
        categoryId: createForm.categoryId || undefined,
      });
      setCreateForm(emptyForm);
      setCreateDialog(false);
    } catch (err) {
      logger.error(err);
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
      await updateService(editId, {
        name: editForm.name,
        description: editForm.description || undefined,
        price: Number(editForm.price),
        duration: Number(editForm.duration),
        category: editForm.categoryId
          ? (categories ?? []).find((c) => c.id === editForm.categoryId)
              ?.name ||
            editForm.category ||
            undefined
          : editForm.category || undefined,
        categoryId: editForm.categoryId || undefined,
        active: editForm.active,
      });
      setEditDialog(false);
      setEditId(null);
    } catch (err) {
      logger.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await removeService(deleteId);
      setDeleteId(null);
    } catch (err) {
      logger.error(err);
      setDeleteError(getErrorMessage(err, "No se pudo eliminar el servicio"));
    } finally {
      setDeleting(false);
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
            const count = categoryCounts.get(cat) ?? 0;
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
              className={`border-0 shadow-sm transition-shadow [contain-intrinsic-size:auto_180px] [content-visibility:auto] hover:shadow-md ${!s.active ? "opacity-60" : ""}`}
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
                        onClick={() => {
                          setDeleteId(s.id);
                          setDeleteError("");
                        }}
                        aria-label={`Eliminar el servicio ${s.name}`}
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
          <Field label="Nombre">
            <Input
              placeholder="Corte clasico"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio (COP)">
              <Input
                type="number"
                placeholder="25000"
                value={createForm.price}
                onChange={(e) =>
                  setCreateForm({ ...createForm, price: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Duracion (min)">
              <Input
                type="number"
                placeholder="30"
                value={createForm.duration}
                onChange={(e) =>
                  setCreateForm({ ...createForm, duration: e.target.value })
                }
                required
              />
            </Field>
          </div>
          <Field label="Categoría">
            <Select
              value={createForm.categoryId}
              onChange={(e) =>
                setCreateForm({ ...createForm, categoryId: e.target.value })
              }
            >
              <option value="">Sin categoría</option>
              {(categories ?? [])
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Descripcion">
            <Textarea
              placeholder="Descripcion del servicio"
              value={createForm.description}
              onChange={(e) =>
                setCreateForm({ ...createForm, description: e.target.value })
              }
              rows={3}
            />
          </Field>
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
          <Field label="Nombre">
            <Input
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio (COP)">
              <Input
                type="number"
                value={editForm.price}
                onChange={(e) =>
                  setEditForm({ ...editForm, price: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Duracion (min)">
              <Input
                type="number"
                value={editForm.duration}
                onChange={(e) =>
                  setEditForm({ ...editForm, duration: e.target.value })
                }
                required
              />
            </Field>
          </div>
          <Field label="Categoría">
            <Select
              value={editForm.categoryId}
              onChange={(e) =>
                setEditForm({ ...editForm, categoryId: e.target.value })
              }
            >
              <option value="">Sin categoría</option>
              {(categories ?? [])
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Descripcion">
            <Textarea
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              rows={3}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Switch
              id="service-active"
              checked={editForm.active}
              onCheckedChange={(checked) =>
                setEditForm({ ...editForm, active: checked })
              }
            />
            <Label htmlFor="service-active">
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

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar servicio"
        confirmLabel="Si, eliminar"
        pendingLabel="Eliminando..."
        pending={deleting}
        variant="destructive"
        error={deleteError}
      >
        Esta accion no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}
