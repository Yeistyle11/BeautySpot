"use client";

// Pagina de servicios: catalogo de servicios del negocio con alta, edicion y baja.
import { useCallback, useState, useMemo } from "react";
import { mensajeDeError, repartirFalloAlGuardar } from "@/lib/error-message";
import { z } from "zod";
import { TablaDeRegistros } from "@/components/ui/tabla-de-registros";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Scissors, Plus, Tag } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { useOrdenDeTabla } from "@/lib/use-orden-de-tabla";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceFormDialog } from "./service-form-dialog";
import {
  ServiceRow,
  COLUMNAS_DE_SERVICIOS,
  type CampoDeOrden,
} from "./service-row";
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

/** Catalogo de servicios del negocio: alta, edicion, baja y reactivacion. */
export default function ServicesPage() {
  const toast = useToast();
  const role = useAuthStore((s) => s.role);
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
  const { data: categories, mutate: recargarCategorias } = useApi<
    ServiceCategory[]
  >(CATEGORIES_KEY, undefined, z.array(serviceCategorySchema));
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [pestana, setPestana] = useState<"activos" | "inactivos">("activos");
  const { orden, alternarOrden } = useOrdenDeTabla<CampoDeOrden>("name");

  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [savingCreate, setSavingCreate] = useState(false);

  const [editDialog, setEditDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Version con la que se abrio el formulario, para que el servidor avise si
  // otra persona toco el servicio mientras tanto.
  const [editVersion, setEditVersion] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState("");
  const [recargando, setRecargando] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const [desactivarId, setDesactivarId] = useState<string | null>(null);
  const [reactivandoId, setReactivandoId] = useState<string | null>(null);
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

  // Etiquetas fuera del catalogo, que el filtro no reconoce.
  const etiquetasHeredadas = useMemo(() => {
    const nombres = new Set(
      services
        .map((s) => s.category ?? "")
        .filter((c) => c && !categoryNames.includes(c))
    );
    return [...nombres].sort();
  }, [services, categoryNames]);

  const filtered = useMemo(() => {
    if (filterCategory === "all") return services;
    if (filterCategory === SIN_CATEGORIA) {
      return services.filter((s) => !categoryNames.includes(s.category ?? ""));
    }
    return services.filter((s) => s.category === filterCategory);
  }, [services, filterCategory, categoryNames]);

  const ordenados = useMemo(() => {
    const factor = orden.direccion === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      orden.campo === "name"
        ? factor * a.name.localeCompare(b.name, "es")
        : factor * (Number(a[orden.campo]) - Number(b[orden.campo]))
    );
  }, [filtered, orden]);

  // Activos e inactivos viven en pestanas separadas: el catalogo que se
  // agenda es el de los activos.
  const activos = useMemo(() => ordenados.filter((s) => s.active), [ordenados]);
  const inactivos = useMemo(
    () => ordenados.filter((s) => !s.active),
    [ordenados]
  );

  // Los contadores cuentan dentro de la pestana visible.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const delEstado = services.filter(
      (s) => s.active === (pestana === "activos")
    );
    for (const s of delEstado) {
      const nombre = s.category ?? "";
      // Lo que no encaja con ninguna categoria del negocio se agrupa aparte,
      // para que ningun servicio desaparezca del listado.
      const clave = categoryNames.includes(nombre) ? nombre : SIN_CATEGORIA;
      counts.set(clave, (counts.get(clave) ?? 0) + 1);
    }
    return counts;
  }, [services, categoryNames, pestana]);

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

  /** Los campos del formulario, tal como se leen de un servicio guardado. */
  const comoFormulario = (s: Service) => ({
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

  // Los permisos se calculan una vez, no por fila.
  const puedeEditar = canDo(role, "services_edit");
  const puedeDesactivar = canDo(role, "services_delete");

  /** Pide confirmacion antes de retirar el servicio del catalogo. */
  const pedirDesactivacion = useCallback((s: Service) => {
    setDesactivarId(s.id);
    setDeleteError("");
  }, []);

  const openEdit = (s: Service) => {
    setEditId(s.id);
    setEditForm(comoFormulario(s));
    setEditVersion(s.updatedAt);
    setConflicto("");
    setEditDialog(true);
  };

  /** Cambia lo escrito por lo que hay guardado, dejando el formulario abierto. */
  const recargarEnEdicion = async () => {
    if (!editId) return;
    setRecargando(true);
    try {
      const frescos = await reload();
      const guardado = z
        .array(serviceSchema)
        .parse(frescos)
        .find((s) => s.id === editId);
      if (!guardado) return;
      setEditForm(comoFormulario(guardado));
      setEditVersion(guardado.updatedAt);
      setConflicto("");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setRecargando(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSavingEdit(true);
    setConflicto("");
    try {
      await updateService(
        editId,
        toServicePayload(
          editForm,
          categories ?? [],
          true,
          editVersion ?? undefined
        )
      );
      setEditDialog(false);
      setEditId(null);
    } catch (err) {
      logger.error(err);
      repartirFalloAlGuardar(err, setConflicto, toast.error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDesactivar = async () => {
    if (!desactivarId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await removeService(desactivarId);
      setDesactivarId(null);
      toast.exito("Servicio desactivado");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
      setDeleteError(mensajeDeError(err, "No se pudo desactivar el servicio"));
    } finally {
      setDeleting(false);
    }
  };

  /** Devuelve el servicio al catalogo que se puede agendar. */
  const reactivar = async (s: Service) => {
    setReactivandoId(s.id);
    try {
      await updateService(s.id, { active: true });
      toast.exito(`"${s.name}" vuelve a estar disponible`);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setReactivandoId(null);
    }
  };

  /** La tabla del catalogo, con el mismo formato para activos e inactivos. */
  const tablaDe = (items: Service[], titulo: string) => (
    <TablaDeRegistros
      titulo={titulo}
      columnas={COLUMNAS_DE_SERVICIOS}
      orden={orden}
      onOrdenar={alternarOrden}
    >
      {items.map((s) => (
        <ServiceRow
          key={s.id}
          service={s}
          categoriaDelCatalogo={categoryNames.includes(s.category ?? "")}
          puedeEditar={puedeEditar}
          puedeDesactivar={puedeDesactivar}
          reactivando={reactivandoId === s.id}
          onEditar={openEdit}
          onDesactivar={pedirDesactivacion}
          onReactivar={reactivar}
        />
      ))}
    </TablaDeRegistros>
  );

  return (
    <div>
      <PageHeader
        titulo="Servicios"
        descripcion="Administra los servicios de tu negocio"
        accion={
          canDo(role, "services_create") && (
            <Button onClick={() => setCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo servicio
            </Button>
          )
        }
      />

      {/*
        Sin taxonomia no hay nada por lo que filtrar, y la pantalla no daba
        ninguna pista de que las categorias se crean en otro sitio: el dueno ve
        etiquetas puestas, no puede filtrar por ellas y no sabe que hacer.
      */}
      {!loading && categoryNames.length === 0 && services.length > 0 && (
        <div className="bg-muted/40 text-muted-foreground mb-4 flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm">
          <Tag className="h-4 w-4 shrink-0" />
          <span>
            Todavía no has creado categorías, así que no se puede filtrar el
            catálogo.
          </span>
          <Link
            href="/dashboard/service-categories"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Crear categorías
          </Link>
        </div>
      )}

      {!loading &&
        categoryNames.length > 0 &&
        etiquetasHeredadas.length > 0 && (
          <div className="bg-muted/40 text-muted-foreground mb-4 flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm">
            <Tag className="h-4 w-4 shrink-0" />
            <span>
              {etiquetasHeredadas.length === 1
                ? `La etiqueta "${etiquetasHeredadas[0]}" no está en el catálogo, así que no se puede filtrar por ella.`
                : `${etiquetasHeredadas.length} etiquetas no están en el catálogo, así que no se puede filtrar por ellas: ${etiquetasHeredadas.join(", ")}.`}
            </span>
            <Link
              href="/dashboard/service-categories"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Crear categorías
            </Link>
          </div>
        )}

      {/* Filtro por categoria. Cada opcion lleva cuantos servicios tiene. */}
      {chips.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Tag className="text-muted-foreground h-4 w-4 shrink-0" />
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filtrar los servicios por categoría"
            className="h-9 w-auto min-w-[260px]"
          >
            <option value="all">
              Todas las categorías (
              {pestana === "activos" ? activos.length : inactivos.length})
            </option>
            {chips.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts.get(cat) ?? 0})
              </option>
            ))}
          </Select>
        </div>
      )}

      {loading ? (
        <LoadingState recurso="los servicios" />
      ) : loadError ? (
        <ErrorDeCarga
          error={loadError}
          recurso="los servicios"
          onReintentar={() => void reload()}
        />
      ) : (
        <Tabs
          value={pestana}
          onValueChange={(v) => setPestana(v as "activos" | "inactivos")}
        >
          <TabsList className="mb-3">
            <TabsTrigger value="activos">
              Activos ({activos.length})
            </TabsTrigger>
            <TabsTrigger value="inactivos">
              Inactivos ({inactivos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            {activos.length === 0 ? (
              <EmptyState
                icon={Scissors}
                titulo={
                  services.length === 0
                    ? "Aún no hay servicios"
                    : "Ningún servicio activo con este filtro"
                }
                descripcion={
                  services.length === 0
                    ? "Crea el primero para poder agendarlo y cobrarlo."
                    : "Prueba con otra categoría o mira la pestaña de inactivos."
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
            ) : (
              tablaDe(activos, "Servicios activos")
            )}
          </TabsContent>

          <TabsContent value="inactivos">
            {inactivos.length === 0 ? (
              <EmptyState
                icon={Scissors}
                titulo="No hay servicios inactivos"
                descripcion="Los servicios que desactives aparecerán aquí y podrás volver a activarlos."
              />
            ) : (
              tablaDe(inactivos, "Servicios inactivos")
            )}
          </TabsContent>
        </Tabs>
      )}

      <ServiceFormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        modo="crear"
        form={createForm}
        onFormChange={setCreateForm}
        onSubmit={handleCreate}
        guardando={savingCreate}
        categorias={categories ?? []}
        onRecargarCategorias={recargarCategorias}
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
        onRecargarCategorias={recargarCategorias}
        conflicto={conflicto}
        onRecargar={() => void recargarEnEdicion()}
        recargando={recargando}
      />

      <ConfirmDialog
        open={!!desactivarId}
        onClose={() => setDesactivarId(null)}
        onConfirm={handleDesactivar}
        title="Desactivar servicio"
        confirmLabel="Sí, desactivar"
        pendingLabel="Desactivando..."
        pending={deleting}
        variant="destructive"
        error={deleteError}
        registro={services.find((s) => s.id === desactivarId)?.name}
        consecuencias="dejará de poder agendarse y saldrá del catálogo activo."
        seConserva="Las citas y los cobros que ya lo incluyen no se tocan, y puedes volver a activarlo cuando quieras desde la pestaña «Inactivos»."
      />
    </div>
  );
}
