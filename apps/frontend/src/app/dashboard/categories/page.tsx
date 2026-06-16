"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  Search,
  ToggleLeft,
  ToggleRight,
  Palette,
  GripVertical,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";

// ─── Tipos ──────────────────────────────────────────────────────────

interface Category {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  active: boolean;
}

interface CategoryForm {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: string;
  active: boolean;
}

const EMPTY_FORM: CategoryForm = {
  name: "",
  description: "",
  icon: "",
  color: "#8B5CF6",
  sortOrder: "0",
  active: true,
};

// ─── Iconos predefinidos ─────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: "Scissors", label: "Tijeras" },
  { value: "Sparkles", label: "Destellos" },
  { value: "Heart", label: "Corazón" },
  { value: "Star", label: "Estrella" },
  { value: "Palette", label: "Paleta" },
  { value: "Wand2", label: "Varita" },
  { value: "Droplet", label: "Gota" },
  { value: "Sun", label: "Sol" },
  { value: "Flower2", label: "Flor" },
  { value: "Gem", label: "Gema" },
  { value: "Crown", label: "Corona" },
  { value: "Feather", label: "Pluma" },
];

const COLOR_PRESETS = [
  "#8B5CF6", // violeta
  "#3B82F6", // azul
  "#10B981", // esmeralda
  "#F59E0B", // ámbar
  "#EF4444", // rojo
  "#EC4899", // rosa
  "#6366F1", // índigo
  "#14B8A6", // teal
  "#F97316", // naranja
  "#64748B", // slate
];

// ─── Componente ──────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { role } = useAuthStore();

  // Estado principal
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Diálogo de creación
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CategoryForm>(EMPTY_FORM);
  const [savingCreate, setSavingCreate] = useState(false);

  // Diálogo de edición
  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  // ─── Carga de datos ────────────────────────────────────────────────

  const load = useCallback(() => {
    api
      .get<Category[]>("/core/categories?active=false")
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, []);

  // ─── Datos derivados ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const term = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.description && c.description.toLowerCase().includes(term)),
    );
  }, [categories, search]);

  const activeCount = useMemo(
    () => categories.filter((c) => c.active).length,
    [categories],
  );

  const inactiveCount = useMemo(
    () => categories.filter((c) => !c.active).length,
    [categories],
  );

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await api.post("/core/categories", {
        name: createForm.name,
        description: createForm.description || undefined,
        icon: createForm.icon || undefined,
        color: createForm.color || undefined,
        sortOrder: Number(createForm.sortOrder) || 0,
      });
      setCreateForm(EMPTY_FORM);
      setCreateDialog(false);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCreate(false);
    }
  };

  const openEdit = (category: Category) => {
    setEditId(category.id);
    setEditForm({
      name: category.name,
      description: category.description || "",
      icon: category.icon || "",
      color: category.color || "#8B5CF6",
      sortOrder: String(category.sortOrder),
      active: category.active,
    });
    setEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    try {
      await api.patch(`/core/categories/${editId}`, {
        name: editForm.name,
        description: editForm.description || undefined,
        icon: editForm.icon || undefined,
        color: editForm.color || undefined,
        sortOrder: Number(editForm.sortOrder) || 0,
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

  const handleToggle = async (category: Category) => {
    try {
      await api.patch(`/core/categories/${category.id}/toggle`, {});
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar esta categoría? Los profesionales asignados perderán la asociación."))
      return;
    try {
      await api.delete(`/core/categories/${id}`);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorías de Profesionales</h1>
          <p className="text-muted-foreground">
            Administra las categorías para clasificar a tu equipo de profesionales
          </p>
        </div>
        {canDo(role, "categories_create") && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva categoría
          </Button>
        )}
      </div>

      {/* Barra de búsqueda y estadísticas */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{activeCount} activa{activeCount !== 1 ? "s" : ""}</span>
          <Separator />
          <span>{inactiveCount} inactiva{inactiveCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Grid de categorías */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando categorías...</p>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <Tag className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-lg font-medium text-muted-foreground">
              {search
                ? "No se encontraron categorías"
                : "No hay categorías creadas"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {search
                ? "Intenta con otro término de búsqueda"
                : 'Haz clic en "Nueva categoría" para crear la primera'}
            </p>
          </div>
        ) : (
          filtered.map((category) => (
            <Card
              key={category.id}
              className={`border-0 shadow-sm hover:shadow-md transition-shadow ${
                !category.active ? "opacity-60" : ""
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `${category.color || "#8B5CF6"}20`,
                      }}
                    >
                      <GripVertical
                        className="h-5 w-5"
                        style={{
                          color: category.color || "#8B5CF6",
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {category.color && (
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        {category.active ? (
                          <Badge variant="success" className="text-xs">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canDo(role, "categories_edit") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(category)}
                        title={category.active ? "Desactivar" : "Activar"}
                      >
                        {category.active ? (
                          <ToggleRight className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                    {canDo(role, "categories_edit") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(category)}
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    {canDo(role, "categories_delete") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                {category.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                )}
                {category.icon && (
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Icono: {category.icon}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Diálogo de creación */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} title="Nueva categoría">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              placeholder="Barbero, Estilista, Colorista..."
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Icono</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={createForm.icon}
              onChange={(e) => setCreateForm({ ...createForm, icon: e.target.value })}
            >
              <option value="">Sin icono</option>
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={createForm.color}
                onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                className="h-10 w-12 cursor-pointer rounded border border-input p-0.5"
              />
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, color: c })}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      createForm.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:border-muted-foreground"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              placeholder="Descripción opcional de la categoría"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Orden</Label>
            <Input
              type="number"
              min="0"
              max="999"
              value={createForm.sortOrder}
              onChange={(e) => setCreateForm({ ...createForm, sortOrder: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={savingCreate}>
              {savingCreate ? "Guardando..." : "Crear categoría"}
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

      {/* Diálogo de edición */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        title="Editar categoría"
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
              <Label>Icono</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={editForm.icon}
                onChange={(e) =>
                  setEditForm({ ...editForm, icon: e.target.value })
                }
              >
                <option value="">Sin icono</option>
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editForm.color}
                  onChange={(e) =>
                    setEditForm({ ...editForm, color: e.target.value })
                  }
                  className="h-10 w-12 cursor-pointer rounded border border-input p-0.5"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, color: c })}
                      className={`h-6 w-6 rounded-full border-2 transition-all ${
                        editForm.color === c
                          ? "border-foreground scale-110"
                          : "border-transparent hover:border-muted-foreground"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Orden</Label>
            <Input
              type="number"
              min="0"
              max="999"
              value={editForm.sortOrder}
              onChange={(e) =>
                setEditForm({ ...editForm, sortOrder: e.target.value })
              }
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
              {editForm.active ? "Categoría activa" : "Categoría inactiva"}
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

// ─── Separador simple ────────────────────────────────────────────────

function Separator() {
  return <span className="text-muted-foreground/30">•</span>;
}