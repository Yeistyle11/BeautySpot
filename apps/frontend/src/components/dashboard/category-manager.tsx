"use client";

import { useState, useMemo, useDeferredValue, type ComponentType } from "react";
import { mutate } from "swr";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo, type ACTIONS } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import { CategoryCard } from "./category-card";
import { CategoryFormDialog, type CategoryForm } from "./category-form-dialog";

const categoryEntitySchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number(),
  active: z.boolean(),
});
export type CategoryEntity = z.infer<typeof categoryEntitySchema>;

const emptyForm = (defaultColor: string): CategoryForm => ({
  name: "",
  description: "",
  icon: "",
  color: defaultColor,
  sortOrder: "0",
  active: true,
});

export interface CategoryManagerConfig {
  apiBasePath: string;
  queryKey: string;
  pageTitle: string;
  pageSubtitle: string;
  namePlaceholder: string;
  emptyStateLabel: string;
  emptyIcon: ComponentType<{ className?: string }>;
  cardIcon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  defaultColor: string;
  colorPresets: string[];
  iconOptions: { value: string; label: string }[];
  actions: {
    create: keyof typeof ACTIONS;
    edit: keyof typeof ACTIONS;
    delete: keyof typeof ACTIONS;
  };
  deleteConfirmMessage: string;
  showIconName?: boolean;
}

/**
 * Pantalla generica de categorias. Las paginas de categorias de profesionales
 * y de servicios se comportan igual y solo cambian textos, iconos y endpoint,
 * asi que ambas se resuelven pasando `config`.
 */
export function CategoryManager({ config }: { config: CategoryManagerConfig }) {
  const { role } = useAuthStore();
  const {
    apiBasePath,
    queryKey,
    pageTitle,
    pageSubtitle,
    namePlaceholder,
    emptyStateLabel,
    emptyIcon: EmptyIcon,
    cardIcon,
    defaultColor,
    colorPresets,
    iconOptions,
    actions,
    deleteConfirmMessage,
    showIconName,
  } = config;

  const { data: categories, isLoading: loading } = useApi<CategoryEntity[]>(
    queryKey,
    undefined,
    z.array(categoryEntitySchema)
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CategoryForm>(
    emptyForm(defaultColor)
  );
  const [savingCreate, setSavingCreate] = useState(false);

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(
    emptyForm(defaultColor)
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => {
    const categoryList = categories ?? [];
    if (!deferredSearch.trim()) return categoryList;
    const term = deferredSearch.toLowerCase();
    return categoryList.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.description && c.description.toLowerCase().includes(term))
    );
  }, [categories, deferredSearch]);

  const { activeCount, inactiveCount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const c of categories ?? []) {
      if (c.active) active++;
      else inactive++;
    }
    return { activeCount: active, inactiveCount: inactive };
  }, [categories]);

  const toPayload = (form: CategoryForm, includeActive = false) => ({
    name: form.name,
    description: form.description || undefined,
    icon: form.icon || undefined,
    color: form.color || undefined,
    sortOrder: Number(form.sortOrder) || 0,
    ...(includeActive ? { active: form.active } : {}),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await api.post(apiBasePath, toPayload(createForm));
      setCreateForm(emptyForm(defaultColor));
      setCreateDialog(false);
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
    } finally {
      setSavingCreate(false);
    }
  };

  const openEdit = (category: CategoryEntity) => {
    setEditId(category.id);
    setEditForm({
      name: category.name,
      description: category.description || "",
      icon: category.icon || "",
      color: category.color || defaultColor,
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
      await api.patch(`${apiBasePath}/${editId}`, toPayload(editForm, true));
      setEditDialog(false);
      setEditId(null);
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggle = async (category: CategoryEntity) => {
    try {
      await api.patch(`${apiBasePath}/${category.id}/toggle`, {});
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`${apiBasePath}/${deleteId}`);
      setDeleteId(null);
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
      setDeleteError(
        getErrorMessage(err, "No se pudo desactivar la categoría")
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>
        {canDo(role, actions.create) && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva categoría
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar categoría"
          />
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <span>
            {activeCount} activa{activeCount !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span>
            {inactiveCount} inactiva{inactiveCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando categorías...</p>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <EmptyIcon className="text-muted-foreground/40 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-3 text-lg font-medium">
              {search
                ? "No se encontraron categorías"
                : `No hay ${emptyStateLabel} creadas`}
            </p>
            <p className="text-muted-foreground/70 mt-1 text-sm">
              {search
                ? "Intenta con otro término de búsqueda"
                : 'Haz clic en "Nueva categoría" para crear la primera'}
            </p>
          </div>
        ) : (
          filtered.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              icon={cardIcon}
              defaultColor={defaultColor}
              canEdit={canDo(role, actions.edit)}
              canDelete={canDo(role, actions.delete)}
              showIconName={showIconName}
              onToggle={handleToggle}
              onEdit={openEdit}
              onDelete={(id) => {
                setDeleteId(id);
                setDeleteError("");
              }}
            />
          ))
        )}
      </div>

      <CategoryFormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        onSubmit={handleCreate}
        form={createForm}
        onChange={setCreateForm}
        title="Nueva categoría"
        submitLabel="Crear categoría"
        namePlaceholder={namePlaceholder}
        iconOptions={iconOptions}
        colorPresets={colorPresets}
        saving={savingCreate}
      />

      <CategoryFormDialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        onSubmit={handleUpdate}
        form={editForm}
        onChange={setEditForm}
        title="Editar categoría"
        submitLabel="Guardar cambios"
        namePlaceholder={namePlaceholder}
        iconOptions={iconOptions}
        colorPresets={colorPresets}
        saving={savingEdit}
        showActiveToggle
        activeLabel={
          editForm.active ? "Categoría activa" : "Categoría inactiva"
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Desactivar categoría"
        confirmLabel="Si, desactivar"
        pendingLabel="Desactivando..."
        pending={deleting}
        variant="destructive"
        error={deleteError}
      >
        {deleteConfirmMessage}
      </ConfirmDialog>
    </div>
  );
}
