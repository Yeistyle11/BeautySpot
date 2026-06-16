"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";

interface Notification { id: string; type: string; channel: string; title: string; message: string; read: boolean; createdAt: string; }

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Notification[]>("/notification/notifications").then(setNotifications).catch(console.error).finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try { await api.post(`/notification/notifications/${id}/read`, {}); setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n)); } catch {}
  };

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold">Notificaciones</h1><p className="text-muted-foreground">Centro de notificaciones</p></div>
      <div className="space-y-3">
        {loading ? <p className="text-muted-foreground">Cargando...</p> :
          notifications.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="p-8 text-center text-muted-foreground"><Bell className="mx-auto h-12 w-12 opacity-20" /><p className="mt-2">No hay notificaciones</p></CardContent></Card>
          ) : notifications.map((n) => (
            <Card key={n.id} className={`border-0 shadow-sm ${!n.read ? "bg-primary/5" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString("es-CO")}</p>
                  </div>
                  {!n.read && <button onClick={() => markRead(n.id)} className="text-primary hover:text-primary/80"><CheckCheck className="h-5 w-5" /></button>}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
