"use client";

// Pagina de servicios: catalogo de servicios del negocio con alta, edicion y baja.
import { useState, useMemo } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Scissors, Plus, Clock, Edit, Trash2, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { getErrorMessage } from "@/lib/utils";
import { ServiceFormDialog } from "./service-form-dialog";
import {
  CATEGORIES_KEY,
  emptyForm,
  serviceCategorySchema,
  serviceSchema,
  SERVICES_KEY,
  toServicePayload,
  type Service,
  type ServiceCategory,
} from "./schemas";

/** Cajon de los servicios que no pertenecen a ninguna categoria del negocio. */
const SIN_CATEGORIA = "Sin categoría";

export default function ServicesPage() {
  const toast = useToast();
  const { role } = useAuthStore();
  const {
    items: services,
    isLoading: loading,
    error: loadError,
    reload,
    create: createService,
    update: updateService,
    remove: removeService,
  } = useCrudResource<Service>({
    listKey: SERVICES_KEY,
    basePath: "/core/services",
    schema: z.array(serviceSchema),
  });
  const { data: categories } = useApi<ServiceCategory[]>(
    CATEGORIES_KEY,
    undefined,
    z.array(serviceCategorySchema)
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

  // Los filtros salen solo de las categorias dadas de alta en "Cat. Servicios",
  // que es la taxonomia del negocio.
  const categoryNames = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => c.active)
        .map((c) => c.name)
        .sort(),
    [categories]
  );

  const filtered = useMemo(() => {
    if (filterCategory === "all") return services;
    if (filterCategory === SIN_CATEGORIA) {
      return services.filter((s) => !categoryNames.includes(s.category ?? ""));
    }
    return services.filter((s) => s.category === filterCategory);
  }, [services, filterCategory, categoryNames]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of services) {
      const nombre = s.category ?? "";
      // Lo que no encaja con ninguna categoria del negocio se agrupa aparte,
      // para que ningun servicio desaparezca del listado.
      const clave = categoryNames.includes(nombre) ? nombre : SIN_CATEGORIA;
      counts.set(clave, (counts.get(clave) ?? 0) + 1);
    }
    return counts;
  }, [services, categoryNames]);

  const chips = useMemo(() => {
    const conServicios = categoryNames.filter((c) => categoryCounts.get(c));
    return categoryCounts.get(SIN_CATEGORIA)
      ? [...conServicios, SIN_CATEGORIA]
      : conServicios;
  }, [categoryNames, categoryCounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      await createService(toServicePayload(createForm, categories ?? []));
      setCreateForm(emptyForm);
      setCreateDialog(false);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
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
      procesadoDesde: s.procesadoDesde == null ? "" : String(s.procesadoDesde),
      procesadoMinutos:
        s.procesadoMinutos == null ? "" : String(s.procesadoMinutos),
      bufferDespues: s.bufferDespues ? String(s.bufferDespues) : "",
      active: s.active,
    });
    setEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    try {
      await updateService(
        editId,
        toServicePayload(editForm, categories ?? [], true)
      );
      setEditDialog(false);
      setEditId(null);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
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
      toast.error(mensajeDeError(err));
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

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Tag className="text-muted-foreground h-4 w-4" />
          <FilterChip
            activo={filterCategory === "all"}
            onClick={() => setFilterCategory("all")}
          >
            Todos ({services.length})
          </FilterChip>
          {chips.map((cat) => {
            const count = categoryCounts.get(cat) ?? 0;
            return (
              <FilterChip
                key={cat}
                activo={filterCategory === cat}
                onClick={() => setFilterCategory(cat)}
              >
                {cat} ({count})
              </FilterChip>
            );
          })}
        </div>
      )}

      {!loading && !loadError && filtered.length === 0 && (
        <EmptyState
          icon={Scissors}
          titulo={
            services.length === 0
              ? "Aun no hay servicios"
              : "Ningun servicio en esta categoría"
          }
          descripcion={
            services.length === 0
              ? "Crea el primero para poder agendarlo y cobrarlo."
              : "Prueba con otra categoría o quita el filtro."
          }
          accion={
            services.length === 0 &&
            canDo(role, "services_create") && (
              <Button onClick={() => setCreateDialog(true)}>
                Nuevo servicio
              </Button>
            )
          }
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : loadError ? (
          <ErrorDeCarga
            error={loadError}
            recurso="los servicios"
            onReintentar={() => void reload()}
          />
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
                  <span className="text-primary font-semibold">
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

      <ServiceFormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        modo="crear"
        form={createForm}
        onFormChange={setCreateForm}
        onSubmit={handleCreate}
        guardando={savingCreate}
        categorias={categories ?? []}
      />

      <ServiceFormDialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        modo="editar"
        form={editForm}
        onFormChange={setEditForm}
        onSubmit={handleUpdate}
        guardando={savingEdit}
        categorias={categories ?? []}
      />

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
