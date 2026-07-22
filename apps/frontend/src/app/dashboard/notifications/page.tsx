"use client";
import { useCallback } from "react";
import { mutate } from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/swr";

interface Notification {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_KEY = "/notification/notifications";

export default function NotificationsPage() {
  const { data: notifications, isLoading: loading } =
    useApi<Notification[]>(NOTIFICATIONS_KEY);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.post(`/notification/notifications/${id}/read`, {});
      await mutate(
        NOTIFICATIONS_KEY,
        (prev: Notification[] | undefined) =>
          prev?.map((n) => (n.id === id ? { ...n, read: true } : n)),
        { revalidate: false }
      );
    } catch {
      /* ignore */
    }
  }, []);

  const list = notifications ?? [];

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
                      {new Date(n.createdAt).toLocaleDateString("es-CO")}
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
    </div>
  );
}
