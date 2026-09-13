"use client";

import { useAltaPorUrl } from "@/lib/alta-por-url";
import { useState, useMemo, useDeferredValue } from "react";
import { mensajeDeError } from "@/lib/error-message";
import { mutate } from "swr";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { ToggleRight, ToggleLeft, Edit, Trash2 } from "lucide-react";
import { resolveCategoryIcon } from "@/components/dashboard/category-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaPrincipal,
} from "@/components/ui/tabla-de-registros";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo, type ACTIONS } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
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
  emptyIcon: LucideIcon;
  cardIcon: LucideIcon;
  defaultColor: string;
  colorPresets: string[];
  iconOptions: { value: string; label: string }[];
  actions: {
    create: keyof typeof ACTIONS;
    edit: keyof typeof ACTIONS;
    delete: keyof typeof ACTIONS;
  };
  deleteConfirmMessage: string;
}

/**
 * Pantalla generica de categorias: la de profesionales y la de servicios se
 * resuelven pasando `config`.
 */
const COLUMNAS_CATEGORIA = [{ label: "Categoría" }];

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
  } = config;

  const { data: categories, isLoading: loading } = useApi<CategoryEntity[]>(
    queryKey,
    undefined,
    z.array(categoryEntitySchema)
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [createDialog, setCreateDialog] = useState(false);
  useAltaPorUrl(() => setCreateDialog(true));
  const [createForm, setCreateForm] = useState<CategoryForm>(
    emptyForm(defaultColor)
  );
  const [savingCreate, setSavingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(
    emptyForm(defaultColor)
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [toggleError, setToggleError] = useState("");

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

  const activas = useMemo(() => filtered.filter((c) => c.active), [filtered]);
  const inactivas = useMemo(
    () => filtered.filter((c) => !c.active),
    [filtered]
  );

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
    setCreateError("");
    try {
      await api.post(apiBasePath, toPayload(createForm));
      setCreateForm(emptyForm(defaultColor));
      setCreateDialog(false);
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
      setCreateError(mensajeDeError(err, "No se pudo crear la categoría"));
    } finally {
      setSavingCreate(false);
    }
  };

  const openEdit = (category: CategoryEntity) => {
    setEditError("");
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
    setEditError("");
    try {
      await api.patch(`${apiBasePath}/${editId}`, toPayload(editForm, true));
      setEditDialog(false);
      setEditId(null);
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
      setEditError(mensajeDeError(err, "No se pudo guardar la categoría"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggle = async (category: CategoryEntity) => {
    setToggleError("");
    try {
      await api.patch(`${apiBasePath}/${category.id}/toggle`, {});
      await mutate(queryKey);
    } catch (err) {
      logger.error(err);
      setToggleError(
        mensajeDeError(err, "No se pudo cambiar el estado de la categoría")
      );
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
      setDeleteError(mensajeDeError(err, "No se pudo desactivar la categoría"));
    } finally {
      setDeleting(false);
    }
  };

  /** Las categorias, con el mismo formato para activas e inactivas. */
  const tablaDe = (items: CategoryEntity[], titulo: string) => (
    <TablaDeRegistros titulo={titulo} columnas={COLUMNAS_CATEGORIA}>
      {items.map((category) => {
        const color = category.color || defaultColor;
        return (
          <FilaDeTabla
            key={category.id}
            acciones={
              <>
                {canDo(role, actions.edit) && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggle(category)}
                      aria-label={`${category.active ? "Desactivar" : "Activar"} la categoría ${category.name}`}
                      title={category.active ? "Desactivar" : "Activar"}
                    >
                      {category.active ? (
                        <ToggleRight className="text-success h-4 w-4" />
                      ) : (
                        <ToggleLeft className="text-muted-foreground h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(category)}
                      aria-label={`Editar la categoría ${category.name}`}
                      title="Editar"
                    >
                      <Edit className="text-muted-foreground h-4 w-4" />
                    </Button>
                  </>
                )}
                {canDo(role, actions.delete) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => {
                      setDeleteId(category.id);
                      setDeleteError("");
                    }}
                    aria-label={`Eliminar la categoría ${category.name}`}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            }
          >
            <CeldaPrincipal
              icono={resolveCategoryIcon(category.icon, cardIcon)}
              colorDelIcono={color}
              titulo={category.name}
              subtitulo={category.description}
            />
          </FilaDeTabla>
        );
      })}
    </TablaDeRegistros>
  );

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
      </div>

      {toggleError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {toggleError}
        </p>
      )}

      {loading ? (
        <LoadingState recurso="las categorías" />
      ) : (
        <Tabs defaultValue="activas">
          <TabsList className="mb-3">
            <TabsTrigger value="activas">
              Activas ({activas.length})
            </TabsTrigger>
            <TabsTrigger value="inactivas">
              Inactivas ({inactivas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activas">
            {activas.length === 0 ? (
              <EmptyState
                icon={EmptyIcon}
                sinTarjeta
                titulo={
                  search
                    ? "No se encontraron categorías"
                    : `Aún no hay ${emptyStateLabel}`
                }
                descripcion={
                  search
                    ? "Intenta con otro término de búsqueda"
                    : 'Haz clic en "Nueva categoría" para crear la primera'
                }
              />
            ) : (
              tablaDe(activas, "Categorías activas")
            )}
          </TabsContent>

          <TabsContent value="inactivas">
            {inactivas.length === 0 ? (
              <EmptyState
                icon={EmptyIcon}
                sinTarjeta
                titulo="No hay categorías inactivas"
                descripcion="Las que desactives aparecerán aquí y podrás volver a activarlas."
              />
            ) : (
              tablaDe(inactivas, "Categorías inactivas")
            )}
          </TabsContent>
        </Tabs>
      )}

      <CategoryFormDialog
        open={createDialog}
        onClose={() => {
          setCreateDialog(false);
          setCreateError("");
        }}
        onSubmit={handleCreate}
        form={createForm}
        onChange={setCreateForm}
        title="Nueva categoría"
        submitLabel="Crear categoría"
        namePlaceholder={namePlaceholder}
        iconOptions={iconOptions}
        colorPresets={colorPresets}
        saving={savingCreate}
        error={createError}
      />

      <CategoryFormDialog
        open={editDialog}
        onClose={() => {
          setEditDialog(false);
          setEditError("");
        }}
        onSubmit={handleUpdate}
        form={editForm}
        onChange={setEditForm}
        title="Editar categoría"
        submitLabel="Guardar cambios"
        namePlaceholder={namePlaceholder}
        iconOptions={iconOptions}
        colorPresets={colorPresets}
        saving={savingEdit}
        error={editError}
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
        confirmLabel="Sí, desactivar"
        pendingLabel="Desactivando..."
        pending={deleting}
        variant="destructive"
        error={deleteError}
        registro={categories?.find((c) => c.id === deleteId)?.name}
        consecuencias={deleteConfirmMessage}
        seConserva="Lo que ya estaba clasificado con ella no se toca."
      />
    </div>
  );
}
