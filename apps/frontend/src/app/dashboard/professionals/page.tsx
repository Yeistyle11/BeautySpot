"use client";

// Pagina del equipo: lista de profesionales con alta, edicion, detalle,
// horario, servicios que presta y baja.
import { useState, useMemo, useCallback } from "react";
import { mensajeDeError } from "@/lib/error-message";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  TablaDeRegistros,
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
} from "@/components/ui/tabla-de-registros";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  Eye,
  Pencil,
  Clock,
  Scissors,
  Trash2,
  Star,
  Users,
} from "lucide-react";
import { formatAniosExperiencia } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { useAltaPorUrl } from "@/lib/alta-por-url";
import {
  useHorarioDeProfesional,
  useServiciosDeProfesional,
} from "./use-ficha-de-profesional";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { CategoryBadge } from "@/components/ui/category-badge";
import Link from "next/link";
import {
  categorySchema,
  emptyForm,
  professionalSchema,
  toProfessionalPayload,
  type Category,
  type Professional,
} from "./schemas";

// Los tres dialogos estan cerrados mientras se navega la lista, que es lo
// habitual: se descargan al abrirlos.
const ProfessionalFormDialog = dynamic(
  () =>
    import("./professional-form-dialog").then((m) => m.ProfessionalFormDialog),
  { ssr: false }
);
const ProfessionalDetailDialog = dynamic(
  () =>
    import("./professional-detail-dialog").then(
      (m) => m.ProfessionalDetailDialog
    ),
  { ssr: false }
);
const ScheduleDialog = dynamic(
  () => import("./schedule-dialog").then((m) => m.ScheduleDialog),
  { ssr: false }
);
const ServicesDialog = dynamic(
  () => import("./services-dialog").then((m) => m.ServicesDialog),
  { ssr: false }
);

const PROFESSIONALS_KEY = "/core/professionals";
const CATEGORIES_KEY = "/core/categories";

const COLUMNAS_EQUIPO = [
  { label: "Profesional" },
  { label: "Especialidades", ocultaEnMovil: true },
  { label: "Experiencia", ocultaEnMovil: true },
  { label: "Valoración", alineacion: "right" as const, ocultaEnMovil: true },
];

/** Equipo del negocio: alta, horario, tarifas y servicios de cada profesional. */
export default function ProfessionalsPage() {
  const toast = useToast();
  const role = useAuthStore((s) => s.role);
  const {
    items: professionals,
    isLoading: loading,
    error: loadError,
    reload,
    create: createProfessional,
    update: updateProfessional,
    remove: removeProfessional,
  } = useCrudResource<Professional>({
    listKey: PROFESSIONALS_KEY,
    basePath: "/core/professionals",
    schema: z.array(professionalSchema),
  });
  const { data: categoriesData, mutate: recargarCategorias } = useApi<
    Category[]
  >(CATEGORIES_KEY, undefined, z.array(categorySchema));
  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);

  const [showCreate, setShowCreate] = useState(false);
  useAltaPorUrl(() => setShowCreate(true));
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const horario = useHorarioDeProfesional();
  const serviciosDelPro = useServiciosDeProfesional();

  const startEdit = useCallback((p: Professional) => {
    setEditId(p.id);
    setViewId(null);
    setForm({
      name: p.name || "",
      bio: p.bio || "",
      specialties: p.specialties?.join(", ") || "",
      yearsExp: String(p.yearsExp || 0),
      category: p.category || "",
      categoryId: p.categoryId || "",
      photo: p.photo || "",
      active: String(p.active),
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProfessional(toProfessionalPayload(form, categories));
      setShowCreate(false);
      setForm(emptyForm);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      await updateProfessional(
        editId,
        toProfessionalPayload(form, categories, true)
      );
      setEditId(null);
      setForm(emptyForm);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await removeProfessional(deleteConfirm);
      setDeleteConfirm(null);
      setDeleteError("");
    } catch (err) {
      setDeleteError(
        mensajeDeError(err, "No se pudo inactivar el profesional")
      );
    }
  };

  const viewed = professionals.find((p) => p.id === viewId);
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const { active: activePros, inactive: inactivePros } = useMemo(() => {
    const active: Professional[] = [];
    const inactive: Professional[] = [];
    for (const p of professionals) {
      (p.active ? active : inactive).push(p);
    }
    return { active, inactive };
  }, [professionals]);

  /** El equipo, con el mismo formato para activos e inactivos. */
  const tablaDe = (items: Professional[], titulo: string) => (
    <TablaDeRegistros titulo={titulo} columnas={COLUMNAS_EQUIPO}>
      {items.map((p) => {
        const nombre = p.name || "Sin nombre";
        return (
          <FilaDeTabla
            key={p.id}
            acciones={
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setViewId(p.id)}
                  aria-label={`Ver la ficha de ${nombre}`}
                  title="Ver ficha"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {canDo(role, "professionals_edit") && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(p)}
                      aria-label={`Editar a ${nombre}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => horario.abrir(p)}
                      aria-label={`Horarios de ${nombre}`}
                      title="Horarios"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => serviciosDelPro.abrir(p)}
                      aria-label={`Servicios de ${nombre}`}
                      title="Servicios"
                    >
                      <Scissors className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {canDo(role, "professionals_delete") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => setDeleteConfirm(p.id)}
                    aria-label={`Inactivar a ${nombre}`}
                    title="Inactivar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            }
          >
            <CeldaPrincipal
              grande
              foto={p.photo}
              inicial={nombre.charAt(0)}
              titulo={nombre}
              subtitulo={
                <CategoryBadge
                  nombre={p.category ?? ""}
                  delCatalogo={Boolean(
                    p.categoryId && categoryMap.has(p.categoryId)
                  )}
                  color={
                    (p.categoryId
                      ? categoryMap.get(p.categoryId)?.color
                      : undefined) ?? undefined
                  }
                />
              }
            />
            <CeldaDeTabla ocultaEnMovil apagada>
              {p.specialties?.length
                ? p.specialties.slice(0, 2).join(", ") +
                  (p.specialties.length > 2
                    ? ` +${p.specialties.length - 2}`
                    : "")
                : "—"}
            </CeldaDeTabla>
            <CeldaDeTabla ocultaEnMovil apagada>
              {formatAniosExperiencia(p.yearsExp)}
            </CeldaDeTabla>
            <CeldaDeTabla alineacion="right" ocultaEnMovil>
              {/* Sin resenas no hay nota, que no es lo mismo que un cero. */}
              {Number(p.rating) > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="fill-rating text-rating h-3.5 w-3.5" />
                  {Number(p.rating).toFixed(1)}
                  <span className="text-muted-foreground">
                    ({p.totalReviews})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </CeldaDeTabla>
          </FilaDeTabla>
        );
      })}
    </TablaDeRegistros>
  );

  return (
    <div>
      <PageHeader
        titulo="Equipo"
        descripcion="Gestiona tus profesionales"
        accion={
          canDo(role, "professionals_create") && (
            <Button
              onClick={() => {
                setShowCreate(true);
                setForm(emptyForm);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          )
        }
      />

      {/*
        Sin categorias dadas de alta, lo que sale en las fichas es texto suelto:
        se ve igual que una categoria y no clasifica nada. La pantalla no decia
        donde se crean.
      */}
      {!loading && categories.length === 0 && professionals.length > 0 && (
        <div className="bg-muted/40 text-muted-foreground mb-4 flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm">
          <span>
            Todavía no has creado categorías de profesional, así que las
            etiquetas del equipo no clasifican nada.
          </span>
          <Link
            href="/dashboard/categories"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Crear categorías
          </Link>
        </div>
      )}

      {loading ? (
        <LoadingState recurso="el equipo" />
      ) : loadError ? (
        <ErrorDeCarga
          error={loadError}
          recurso="los profesionales"
          onReintentar={() => void reload()}
        />
      ) : (
        <Tabs defaultValue="activos">
          <TabsList className="mb-3">
            <TabsTrigger value="activos">
              Activos ({activePros.length})
            </TabsTrigger>
            <TabsTrigger value="inactivos">
              Inactivos ({inactivePros.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            {activePros.length === 0 ? (
              <EmptyState
                icon={Users}
                titulo="Aún no hay profesionales"
                descripcion="Da de alta a quien atiende para poder asignarle citas."
                accion={
                  canDo(role, "professionals_create") && (
                    <Button
                      onClick={() => {
                        setShowCreate(true);
                        setForm(emptyForm);
                      }}
                    >
                      Nuevo profesional
                    </Button>
                  )
                }
              />
            ) : (
              tablaDe(activePros, "Profesionales activos")
            )}
          </TabsContent>

          <TabsContent value="inactivos">
            {inactivePros.length === 0 ? (
              <EmptyState
                icon={Users}
                titulo="No hay profesionales inactivos"
                descripcion="Quien des de baja aparecerá aquí y podrás volver a activarlo."
              />
            ) : (
              tablaDe(inactivePros, "Profesionales inactivos")
            )}
          </TabsContent>
        </Tabs>
      )}

      <ProfessionalDetailDialog
        professional={viewed}
        onClose={() => setViewId(null)}
        onEdit={startEdit}
      />

      <ProfessionalFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        form={form}
        onChange={setForm}
        categories={categories}
        onRecargarCategorias={recargarCategorias}
        title="Nuevo profesional"
        submitLabel="Crear profesional"
      />

      <ProfessionalFormDialog
        open={!!editId}
        onClose={() => {
          setEditId(null);
          setForm(emptyForm);
        }}
        onSubmit={handleUpdate}
        form={form}
        onChange={setForm}
        categories={categories}
        onRecargarCategorias={recargarCategorias}
        title="Editar profesional"
        submitLabel="Guardar cambios"
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError("");
        }}
        onConfirm={handleDelete}
        title="Inactivar profesional"
        confirmLabel="Sí, inactivar"
        variant="destructive"
        error={deleteError}
        registro={
          professionals.find((p) => p.id === deleteConfirm)?.name ?? undefined
        }
        consecuencias="quedará marcado como inactivo y dejará de recibir citas nuevas."
        seConserva="Su historial se conserva, y si tiene citas pendientes la acción será rechazada."
      />

      <ServicesDialog
        open={serviciosDelPro.abierto}
        onClose={serviciosDelPro.cerrar}
        onSave={serviciosDelPro.guardar}
        professional={serviciosDelPro.profesional}
        servicios={serviciosDelPro.servicios}
        filas={serviciosDelPro.filas}
        onChange={serviciosDelPro.setFilas}
        saving={serviciosDelPro.guardando}
        cargando={serviciosDelPro.cargando}
        error={serviciosDelPro.error}
      />

      <ScheduleDialog
        open={horario.abierto}
        onClose={horario.cerrar}
        onSave={horario.guardar}
        professional={horario.profesional}
        hours={horario.semana}
        onChange={horario.setSemana}
        saving={horario.guardando}
        error={horario.error}
      />
    </div>
  );
}
