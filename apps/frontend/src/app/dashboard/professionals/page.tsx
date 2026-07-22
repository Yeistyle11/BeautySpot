"use client";
import { useState, useMemo, useCallback, memo } from "react";
import Image from "next/image";
import { mutate } from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Star,
  Briefcase,
  Eye,
  Pencil,
  Trash2,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/utils";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
import type { Role } from "@/lib/store";

interface Professional {
  id: string;
  name: string | null;
  photo: string | null;
  bio: string | null;
  category: string | null;
  categoryId: string | null;
  specialties: string[];
  yearsExp: number;
  rating: string;
  totalReviews: number;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
}

interface AvailabilitySlot {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
}

const DAYS_MAP = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

const emptyForm = {
  name: "",
  bio: "",
  specialties: "",
  yearsExp: "0",
  category: "",
  categoryId: "",
  photo: "",
  active: "true",
};

const ProCard = memo(function ProCard({
  p,
  categoryMap,
  role,
  onView,
  onEdit,
  onDelete,
  onSchedule,
}: {
  p: Professional;
  categoryMap: Map<string, Category>;
  role: Role | null;
  onView: (id: string) => void;
  onEdit: (p: Professional) => void;
  onDelete: (id: string) => void;
  onSchedule: (p: Professional) => void;
}) {
  return (
    <Card
      className={`border-0 shadow-sm transition-shadow [contain-intrinsic-size:auto_260px] [content-visibility:auto] hover:shadow-md ${!p.active ? "opacity-60" : ""}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {p.photo ? (
            <Image
              src={p.photo}
              alt={p.name || ""}
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {(p.name || "?").charAt(0)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name || "Sin nombre"}</p>
            {p.category && (
              <Badge
                variant="secondary"
                className="mt-0.5 text-xs"
                style={
                  p.categoryId
                    ? {
                        backgroundColor: `${categoryMap.get(p.categoryId)?.color || "#8B5CF6"}20`,
                        color:
                          categoryMap.get(p.categoryId)?.color || undefined,
                      }
                    : undefined
                }
              >
                {p.category}
              </Badge>
            )}
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-muted-foreground text-sm">
                {Number(p.rating).toFixed(1)} ({p.totalReviews})
              </span>
            </div>
          </div>
        </div>

        {p.bio && (
          <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
            {p.bio}
          </p>
        )}

        {p.specialties?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.specialties.slice(0, 3).map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
            {p.specialties.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{p.specialties.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Briefcase className="h-3.5 w-3.5" /> {p.yearsExp} anos de experiencia
        </div>

        <div className="mt-4 flex gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => onView(p.id)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> Ver
          </Button>
          {canDo(role, "professionals_edit") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => onEdit(p)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
          )}
          {canDo(role, "professionals_edit") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => onSchedule(p)}
            >
              <Clock className="mr-1 h-3.5 w-3.5" /> Horarios
            </Button>
          )}
          {canDo(role, "professionals_delete") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive h-8 px-2"
              onClick={() => onDelete(p.id)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default function ProfessionalsPage() {
  const { role } = useAuthStore();
  const PROFESSIONALS_KEY = "/core/professionals";
  const CATEGORIES_KEY = "/core/categories";
  const { data: professionals, isLoading: loading } =
    useApi<Professional[]>(PROFESSIONALS_KEY);
  const { data: categories } = useApi<Category[]>(CATEGORIES_KEY);
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schedulePro, setSchedulePro] = useState<Professional | null>(null);
  const [scheduleHours, setScheduleHours] = useState<
    Record<number, { active: boolean; startTime: string; endTime: string }>
  >({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const openSchedule = useCallback((p: Professional) => {
    setSchedulePro(p);
    api
      .get<AvailabilitySlot[]>(`/booking/professionals/${p.id}/availability`)
      .then((data) => {
        const map: Record<
          number,
          { active: boolean; startTime: string; endTime: string }
        > = {};
        DAYS_MAP.forEach((d) => {
          map[d.value] = {
            active: false,
            startTime: "08:00",
            endTime: "18:00",
          };
        });
        data.forEach((a) => {
          map[a.dayOfWeek] = {
            active: a.active !== false,
            startTime: a.startTime,
            endTime: a.endTime,
          };
        });
        setScheduleHours(map);
      })
      .catch(() => {
        const map: Record<
          number,
          { active: boolean; startTime: string; endTime: string }
        > = {};
        DAYS_MAP.forEach((d) => {
          map[d.value] = {
            active: d.value >= 1 && d.value <= 5,
            startTime: "08:00",
            endTime: "18:00",
          };
        });
        setScheduleHours(map);
      });
    setScheduleDialog(true);
  }, []);

  const saveSchedule = async () => {
    if (!schedulePro) return;
    setSavingSchedule(true);
    try {
      const hours = Object.entries(scheduleHours).map(([dayStr, h]) => ({
        dayOfWeek: parseInt(dayStr),
        startTime: h.startTime,
        endTime: h.endTime,
        active: h.active,
      }));
      await api.put(`/booking/professionals/${schedulePro.id}/availability`, {
        hours,
      });
      setScheduleDialog(false);
    } catch (err) {
      logger.error(err);
    } finally {
      setSavingSchedule(false);
    }
  };

  const load = async () => {
    await Promise.all([mutate(PROFESSIONALS_KEY), mutate(CATEGORIES_KEY)]);
  };
  void load;

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
      await api.post("/core/professionals", {
        name: form.name,
        bio: form.bio || undefined,
        specialties: form.specialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExp: Number(form.yearsExp),
        category: form.categoryId
          ? (categories ?? []).find((c) => c.id === form.categoryId)?.name ||
            form.category ||
            undefined
          : form.category || undefined,
        categoryId: form.categoryId || undefined,
        photo: form.photo || undefined,
      });
      setShowCreate(false);
      setForm(emptyForm);
      await mutate(PROFESSIONALS_KEY);
    } catch (err) {
      logger.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      await api.patch(`/core/professionals/${editId}`, {
        name: form.name,
        bio: form.bio || undefined,
        specialties: form.specialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExp: Number(form.yearsExp),
        category: form.categoryId
          ? (categories ?? []).find((c) => c.id === form.categoryId)?.name ||
            form.category ||
            undefined
          : form.category || undefined,
        categoryId: form.categoryId || undefined,
        photo: form.photo || undefined,
        active: form.active === "true",
      });
      setEditId(null);
      setForm(emptyForm);
      await mutate(PROFESSIONALS_KEY);
    } catch (err) {
      logger.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/core/professionals/${id}`);
      setDeleteConfirm(null);
      setDeleteError("");
      await mutate(PROFESSIONALS_KEY);
    } catch (err) {
      setDeleteError(
        getErrorMessage(err, "No se pudo inactivar el profesional")
      );
    }
  };

  const viewed = (professionals ?? []).find((p) => p.id === viewId);
  const professionalList = professionals ?? [];
  const categoryList = categories ?? [];
  const categoryMap = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  );
  const { active: activePros, inactive: inactivePros } = useMemo(() => {
    const active: Professional[] = [];
    const inactive: Professional[] = [];
    for (const p of professionals ?? []) {
      (p.active ? active : inactive).push(p);
    }
    return { active, inactive };
  }, [professionals]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">Gestiona tus profesionales</p>
        </div>
        {canDo(role, "professionals_create") && (
          <Button
            onClick={() => {
              setShowCreate(true);
              setForm(emptyForm);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      {/* Listado */}
      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : professionalList.length === 0 ? (
        <p className="text-muted-foreground">
          No hay profesionales registrados
        </p>
      ) : (
        <>
          {/* Activos */}
          {activePros.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                Activos ({activePros.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activePros.map((p) => (
                  <ProCard
                    key={p.id}
                    p={p}
                    categoryMap={categoryMap}
                    role={role}
                    onView={setViewId}
                    onEdit={startEdit}
                    onDelete={setDeleteConfirm}
                    onSchedule={openSchedule}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactivos */}
          {inactivePros.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                Inactivos ({inactivePros.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactivePros.map((p) => (
                  <ProCard
                    key={p.id}
                    p={p}
                    categoryMap={categoryMap}
                    role={role}
                    onView={setViewId}
                    onEdit={startEdit}
                    onDelete={setDeleteConfirm}
                    onSchedule={openSchedule}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Ver detalle */}
      <Dialog
        open={!!viewed}
        onClose={() => setViewId(null)}
        title="Detalle del profesional"
      >
        {viewed && (
          <div>
            <div className="mb-5 flex items-start gap-5">
              {viewed.photo ? (
                <Image
                  src={viewed.photo}
                  alt={viewed.name || ""}
                  width={96}
                  height={96}
                  unoptimized
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <div className="bg-primary/10 text-primary flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold">
                  {(viewed.name || "?").charAt(0)}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold">
                  {viewed.name || "Sin nombre"}
                </h3>
                {viewed.category && (
                  <Badge className="mt-1">{viewed.category}</Badge>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm">
                    {Number(viewed.rating).toFixed(1)} ({viewed.totalReviews}{" "}
                    resenas)
                  </span>
                  <Badge variant={viewed.active ? "default" : "secondary"}>
                    {viewed.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>
            </div>

            {viewed.bio && (
              <div className="mb-4">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  Biografia
                </p>
                <p className="text-sm">{viewed.bio}</p>
              </div>
            )}

            <div className="mb-4">
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Especialidades
              </p>
              <div className="flex flex-wrap gap-1">
                {viewed.specialties?.length > 0 ? (
                  viewed.specialties.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Sin especialidades
                  </span>
                )}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Experiencia
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Briefcase className="text-muted-foreground h-4 w-4" />{" "}
                {viewed.yearsExp} anos de experiencia
              </p>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button
                onClick={() => {
                  startEdit(viewed);
                  setViewId(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="outline" onClick={() => setViewId(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal: Crear */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo profesional"
        wide
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Carlos Professional"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <select
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">Sin categoría</option>
                {categoryList
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Especialidades</Label>
              <Input
                placeholder="cortes, barba, tintes"
                value={form.specialties}
                onChange={(e) =>
                  setForm({ ...form, specialties: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Experiencia (anos)</Label>
              <Input
                type="number"
                value={form.yearsExp}
                onChange={(e) => setForm({ ...form, yearsExp: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>URL foto de perfil</Label>
              <Input
                placeholder="https://..."
                value={form.photo}
                onChange={(e) => setForm({ ...form, photo: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Biografia</Label>
              <Input
                placeholder="Breve descripcion profesional..."
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Crear profesional</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal: Editar */}
      <Dialog
        open={!!editId}
        onClose={() => {
          setEditId(null);
          setForm(emptyForm);
        }}
        title="Editar profesional"
        wide
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <select
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">Sin categoría</option>
                {categoryList
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Especialidades</Label>
              <Input
                value={form.specialties}
                onChange={(e) =>
                  setForm({ ...form, specialties: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Experiencia (anos)</Label>
              <Input
                type="number"
                value={form.yearsExp}
                onChange={(e) => setForm({ ...form, yearsExp: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>URL foto de perfil</Label>
              <Input
                value={form.photo}
                onChange={(e) => setForm({ ...form, photo: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Biografia</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit">Guardar cambios</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal: Eliminar */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError("");
        }}
        title="Inactivar profesional"
      >
        {deleteConfirm && (
          <div>
            {deleteError ? (
              <div className="space-y-3">
                <p className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
                  {deleteError}
                </p>
                <p className="text-muted-foreground text-sm">
                  Si el profesional tiene citas pendientes o confirmadas, debes
                  cancelarlas o reasignarlas antes de inactivarlo.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteConfirm(null);
                    setDeleteError("");
                  }}
                >
                  Entendido
                </Button>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  Estas seguro de inactivar a{" "}
                  <strong>
                    {professionalList.find((p) => p.id === deleteConfirm)?.name}
                  </strong>
                  ?
                </p>
                <p className="text-muted-foreground mb-4 text-xs">
                  El profesional sera marcado como inactivo. Si tiene citas
                  pendientes, la accion sera rechazada.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(deleteConfirm)}
                  >
                    Si, inactivar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Modal: Disponibilidad */}
      <Dialog
        open={scheduleDialog}
        onClose={() => setScheduleDialog(false)}
        title={`Horarios de ${schedulePro?.name || ""}`}
        wide
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {DAYS_MAP.map((day) => {
              const h = scheduleHours[day.value];
              if (!h) return null;
              return (
                <div
                  key={day.value}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <span className="w-20 text-sm font-medium">{day.label}</span>
                  <Switch
                    checked={h.active}
                    onCheckedChange={(checked) =>
                      setScheduleHours({
                        ...scheduleHours,
                        [day.value]: { ...h, active: checked },
                      })
                    }
                  />
                  {h.active ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={h.startTime}
                        onChange={(e) =>
                          setScheduleHours({
                            ...scheduleHours,
                            [day.value]: { ...h, startTime: e.target.value },
                          })
                        }
                        className="h-8 w-28 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">a</span>
                      <Input
                        type="time"
                        value={h.endTime}
                        onChange={(e) =>
                          setScheduleHours({
                            ...scheduleHours,
                            [day.value]: { ...h, endTime: e.target.value },
                          })
                        }
                        className="h-8 w-28 text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No disponible
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? "Guardando..." : "Guardar horarios"}
            </Button>
            <Button variant="outline" onClick={() => setScheduleDialog(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
