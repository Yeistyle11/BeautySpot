"use client";

// Pagina del equipo: lista de profesionales con alta, edicion, detalle,
// horario, servicios que presta y baja.
import { useState, useMemo, useCallback, useRef } from "react";
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
import { api } from "@/lib/api";
import { formatAniosExperiencia } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { useAltaPorUrl } from "@/lib/alta-por-url";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { CategoryBadge } from "@/components/ui/category-badge";
import Link from "next/link";
import {
  cambiosDeTarifas,
  categorySchema,
  DAYS_MAP,
  filasDeTarifas,
  TRAMO_POR_DEFECTO,
  emptyForm,
  professionalSchema,
  servicioDelCatalogoSchema,
  tarifaSchema,
  toProfessionalPayload,
  type AvailabilitySlot,
  type Category,
  type DayHours,
  type FilaDeTarifa,
  type Professional,
  type ServicioDelCatalogo,
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
const SERVICES_KEY = "/core/services";

function semanaVacia(): Record<number, DayHours> {
  return Object.fromEntries(DAYS_MAP.map((d) => [d.value, []]));
}

/** Horario por defecto: laborables de 8 a 18, fin de semana cerrado. */
function defaultWeek(): Record<number, DayHours> {
  return Object.fromEntries(
    DAYS_MAP.map((d) => [
      d.value,
      d.value >= 1 && d.value <= 5 ? [TRAMO_POR_DEFECTO] : [],
    ])
  );
}

const COLUMNAS_EQUIPO = [
  { label: "Profesional" },
  { label: "Especialidades", ocultaEnMovil: true },
  { label: "Experiencia", ocultaEnMovil: true },
  { label: "Valoración", alineacion: "right" as const, ocultaEnMovil: true },
];

export default function ProfessionalsPage() {
  const toast = useToast();
  const { role } = useAuthStore();
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

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schedulePro, setSchedulePro] = useState<Professional | null>(null);
  const [scheduleHours, setScheduleHours] = useState<Record<number, DayHours>>(
    {}
  );
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const [servicesDialog, setServicesDialog] = useState(false);
  const [servicesPro, setServicesPro] = useState<Professional | null>(null);
  const [servicios, setServicios] = useState<ServicioDelCatalogo[]>([]);
  const [filas, setFilas] = useState<FilaDeTarifa[]>([]);
  const [filasCargadas, setFilasCargadas] = useState<FilaDeTarifa[]>([]);
  const [cargandoTarifas, setCargandoTarifas] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesError, setServicesError] = useState("");

  // De quien es la ultima peticion de horario en vuelo. Abrir dos profesionales
  // seguidos lanza dos peticiones, y la primera puede contestar despues: al
  // volver se compara contra esta ref y la respuesta que ya no toca se descarta.
  const horarioPedidoPara = useRef<string | null>(null);

  /**
   * Abre el dialogo de horario de un profesional y pide su semana a mano,
   * sin pasar por SWR.
   */
  const openSchedule = useCallback((p: Professional) => {
    setSchedulePro(p);
    setScheduleDialog(true);
    horarioPedidoPara.current = p.id;
    api
      .get<AvailabilitySlot[]>(`/booking/professionals/${p.id}/availability`)
      .then((slots) => {
        if (horarioPedidoPara.current !== p.id) return;
        // El backend solo devuelve los dias configurados; el resto queda sin
        // tramos para que la semana salga completa en el formulario.
        const week = semanaVacia();
        slots.forEach((slot) => {
          if (slot.active === false) return;
          week[slot.dayOfWeek] = [
            ...(week[slot.dayOfWeek] ?? []),
            { startTime: slot.startTime, endTime: slot.endTime },
          ];
        });
        setScheduleHours(week);
      })
      .catch(() => {
        if (horarioPedidoPara.current !== p.id) return;
        // Si el profesional aun no tiene horario, se propone el estandar en
        // vez de dejar el formulario vacio.
        setScheduleHours(defaultWeek());
      });
  }, []);

  const saveSchedule = async () => {
    if (!schedulePro) return;
    setSavingSchedule(true);
    setScheduleError("");
    try {
      // Un dia sin tramos es un dia libre y no se envia.
      const slots = Object.entries(scheduleHours).flatMap(([day, tramos]) =>
        tramos.map((tramo) => ({
          dayOfWeek: Number(day),
          startTime: tramo.startTime,
          endTime: tramo.endTime,
        }))
      );

      await api.post(`/booking/professionals/${schedulePro.id}/availability`, {
        slots,
      });
      setScheduleDialog(false);
    } catch (err) {
      logger.error(err);
      // El motivo se muestra en el dialogo, junto a los campos a corregir.
      setScheduleError(mensajeDeError(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  // De quien es la ultima peticion de tarifas en vuelo, por el mismo motivo
  // que en los horarios: abrir dos fichas seguidas puede contestar al reves.
  const tarifasPedidasPara = useRef<string | null>(null);

  /**
   * Abre el diálogo de servicios de un profesional. Las dos mitades se piden a
   * la vez —el catálogo del negocio y lo que ya tiene asignado— porque las
   * filas solo se pueden armar con las dos.
   */
  const openServices = useCallback((p: Professional) => {
    setServicesPro(p);
    setServicesDialog(true);
    setServicesError("");
    setCargandoTarifas(true);
    setFilas([]);
    setFilasCargadas([]);
    tarifasPedidasPara.current = p.id;

    Promise.all([
      api.get<unknown>(SERVICES_KEY),
      api.get<unknown>(`/core/professionals/${p.id}/services`),
    ])
      .then(([catalogo, asignados]) => {
        if (tarifasPedidasPara.current !== p.id) return;
        // Un servicio dado de baja no se ofrece para asignar; el que ya lo
        // tuviera asignado lo conserva hasta que alguien lo quite.
        const activos = z
          .array(servicioDelCatalogoSchema)
          .parse(catalogo)
          .filter((s) => s.active);
        const iniciales = filasDeTarifas(
          activos,
          z.array(tarifaSchema).parse(asignados)
        );
        setServicios(activos);
        setFilas(iniciales);
        setFilasCargadas(iniciales);
        setCargandoTarifas(false);
      })
      .catch((err) => {
        if (tarifasPedidasPara.current !== p.id) return;
        logger.error(err);
        setServicesError(mensajeDeError(err));
        setCargandoTarifas(false);
      });
  }, []);

  const saveServices = async () => {
    if (!servicesPro) return;
    const cambios = cambiosDeTarifas(filasCargadas, filas);

    // Sin cambios no se llama al servidor: reasignar lo mismo escribiría en la
    // ficha de todos modos.
    if (cambios.asignar.length === 0 && cambios.quitar.length === 0) {
      setServicesDialog(false);
      return;
    }

    setSavingServices(true);
    setServicesError("");
    try {
      const ruta = `/core/professionals/${servicesPro.id}/services`;
      // En serie y no en paralelo: son pocas y así el primer fallo deja el
      // resto sin tocar, en vez de a medias sin saber por dónde iba.
      for (const asignacion of cambios.asignar) {
        await api.post(ruta, asignacion);
      }
      for (const serviceId of cambios.quitar) {
        await api.delete(`${ruta}/${serviceId}`);
      }
      setServicesDialog(false);
    } catch (err) {
      logger.error(err);
      setServicesError(mensajeDeError(err));
    } finally {
      setSavingServices(false);
    }
  };

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
                      onClick={() => openSchedule(p)}
                      aria-label={`Horarios de ${nombre}`}
                      title="Horarios"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openServices(p)}
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
        open={servicesDialog}
        onClose={() => setServicesDialog(false)}
        onSave={saveServices}
        professional={servicesPro}
        servicios={servicios}
        filas={filas}
        onChange={setFilas}
        saving={savingServices}
        cargando={cargandoTarifas}
        error={servicesError}
      />

      <ScheduleDialog
        open={scheduleDialog}
        onClose={() => setScheduleDialog(false)}
        onSave={saveSchedule}
        professional={schedulePro}
        hours={scheduleHours}
        onChange={setScheduleHours}
        saving={savingSchedule}
        error={scheduleError}
      />
    </div>
  );
}
