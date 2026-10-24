"use client";

// Pagina de notificaciones: bandeja del usuario, en la misma tabla que el resto
// de listados, con marcado de leidas y paginacion.
import { useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { mutate } from "swr";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { AccionesDeFila } from "@/components/ui/acciones-de-fila";
import {
  CeldaDeTabla,
  FilaDeTabla,
  TablaDeRegistros,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { Bell, CheckCheck } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import type { IPaginatedResponse } from "@beautyspot/shared-types";
import { cn, formatDate } from "@/lib/utils";

const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  channel: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});
type Notification = z.infer<typeof notificationSchema>;

const NOTIFICATIONS_KEY = "/notification/notifications";

/** En movil la fecha va bajo el aviso y el estado se lee en el fondo de la fila. */
const COLUMNAS_DE_AVISOS: ColumnaDeTabla[] = [
  { label: "Aviso" },
  { label: "Fecha", ocultaEnMovil: true },
  { label: "Estado", ocultaEnMovil: true },
];

/** Centro de avisos del usuario, con marcado de leidos. */
export default function NotificationsPage() {
  const {
    items: list,
    meta,
    setPage,
    listKey,
    isLoading: loading,
    error: loadError,
    mutate: recargar,
  } = usePaginatedList<Notification>({
    basePath: NOTIFICATIONS_KEY,
    itemSchema: notificationSchema,
  });

  const markRead = useCallback(
    async (id: string) => {
      try {
        await api.post(`/notification/notifications/${id}/read`, {});
        // La respuesta cacheada es la página { data, meta }: se actualiza el
        // item dentro de `data` sin descartar los metadatos de paginación.
        await mutate(
          listKey,
          (prev: IPaginatedResponse<Notification> | undefined) =>
            prev
              ? {
                  ...prev,
                  data: prev.data.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                  ),
                }
              : prev,
          { revalidate: false }
        );
      } catch (err: unknown) {
        // Marcar como leida es un efecto secundario de abrir la notificacion:
        // si falla, el usuario ya tiene lo que venia a buscar y volvera a
        // intentarse en la siguiente visita.
        logger.error(err);
      }
    },
    [listKey]
  );

  return (
    <div>
      <PageHeader
        titulo="Notificaciones"
        descripcion="Centro de notificaciones"
      />
      {loading ? (
        <LoadingState recurso="los avisos" />
      ) : loadError ? (
        <ErrorDeCarga
          error={loadError}
          recurso="las notificaciones"
          onReintentar={() => void recargar()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Bell}
          titulo="Aún no hay notificaciones"
          descripcion="Aquí aparecerán los avisos de tus citas y pagos."
        />
      ) : (
        <TablaDeRegistros titulo="Notificaciones" columnas={COLUMNAS_DE_AVISOS}>
          {list.map((n) => (
            <FilaDeTabla
              key={n.id}
              className={n.read ? undefined : "bg-primary/5"}
              acciones={
                <AccionesDeFila
                  sobre={`el aviso «${n.title}»`}
                  acciones={[
                    {
                      etiqueta: "Marcar como leído",
                      descripcion: "Marcar el aviso como leido",
                      icono: CheckCheck,
                      alElegir: () => markRead(n.id),
                      visible: !n.read,
                    },
                  ]}
                />
              }
            >
              {/* El mensaje se lee entero: no se corta como el nombre de un
                  registro. */}
              <CeldaDeTabla className="w-full md:w-auto">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Bell className="text-primary h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "break-words",
                        n.read ? "font-medium" : "font-semibold"
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 break-words text-sm">
                      {n.message}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs md:hidden">
                      {formatDate(n.createdAt)}
                      {!n.read && " · Nuevo"}
                    </p>
                  </div>
                </div>
              </CeldaDeTabla>
              <CeldaDeTabla apagada ocultaEnMovil>
                <span className="whitespace-nowrap">
                  {formatDate(n.createdAt)}
                </span>
              </CeldaDeTabla>
              <CeldaDeTabla ocultaEnMovil>
                <Badge variant={n.read ? "muted" : "accent"}>
                  {n.read ? "Leído" : "Nuevo"}
                </Badge>
              </CeldaDeTabla>
            </FilaDeTabla>
          ))}
        </TablaDeRegistros>
      )}

      <Pagination
        meta={meta}
        onPageChange={setPage}
        itemLabel="notificaciones"
      />
    </div>
  );
}
