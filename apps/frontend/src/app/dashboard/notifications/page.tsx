"use client";
import { useCallback } from "react";
import { mutate } from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCheck } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { Pagination } from "@/components/ui/pagination";
import type { IPaginatedResponse } from "@beautyspot/shared-types";
import { formatDate } from "@/lib/utils";

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

export default function NotificationsPage() {
  const {
    items: list,
    meta,
    setPage,
    listKey,
    isLoading: loading,
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
      } catch {
        /* ignore */
      }
    },
    [listKey]
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <p className="text-muted-foreground">Centro de notificaciones</p>
      </div>
      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : list.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-muted-foreground p-8 text-center">
              <Bell className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-2">No hay notificaciones</p>
            </CardContent>
          </Card>
        ) : (
          list.map((n) => (
            <Card
              key={n.id}
              className={`border-0 shadow-sm ${!n.read ? "bg-primary/5" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {n.message}
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-primary hover:text-primary/80"
                    >
                      <CheckCheck className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Pagination
        meta={meta}
        onPageChange={setPage}
        itemLabel="notificaciones"
      />
    </div>
  );
}
