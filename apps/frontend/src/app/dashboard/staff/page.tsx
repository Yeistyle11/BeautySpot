"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  ArrowUpDown,
  Users,
  UserCircle,
  Link2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/utils";

interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  active: boolean;
  membershipId: string;
  role: string;
  membershipActive: boolean;
  joinedAt: string;
  professionalId?: string | null;
}

interface Professional {
  id: string;
  name: string | null;
  userId: string | null;
  active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Dueno",
  ADMIN: "Administrador",
  PROFESSIONAL: "Profesional",
  RECEPTIONIST: "Recepcionista",
  CLIENT: "Cliente",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  OWNER: "bg-amber-100 text-amber-700",
  ADMIN: "bg-blue-100 text-blue-700",
  PROFESSIONAL: "bg-green-100 text-green-700",
  RECEPTIONIST: "bg-cyan-100 text-cyan-700",
  CLIENT: "bg-gray-100 text-gray-600",
};

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "PROFESSIONAL",
  "RECEPTIONIST",
];

const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  role: "PROFESSIONAL",
  professionalId: "",
};

type SortField = "name" | "email" | "role" | "active" | "joinedAt";
type SortDir = "asc" | "desc";

function exportCSV(members: StaffMember[], filename: string) {
  const headers = [
    "Nombre",
    "Email",
    "Telefono",
    "Rol",
    "Estado",
    "Fecha registro",
  ];
  const rows = members.map((s) => [
    s.name,
    s.email,
    s.phone || "",
    ROLE_LABELS[s.role] || s.role,
    s.active ? "Activo" : "Inactivo",
    s.joinedAt ? new Date(s.joinedAt).toLocaleDateString("es-CO") : "",
  ]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

export default function StaffPage() {
  const { role } = useAuthStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Crear
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  // Editar (unificado)
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    newPassword: "",
    confirmPassword: "",
    role: "" as string,
    active: true,
    professionalId: "",
    unlinkProfessional: false,
  });

  // Confirmar desactivar/eliminar
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    Promise.all([
      api.get<StaffMember[]>("/auth/users/business"),
      api.get<Professional[]>("/core/professionals"),
    ])
      .then(([staffData, proData]) => {
        setStaff(staffData);
        setProfessionals(proData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Profesionales sin vincular
  const unlinkedPros = professionals.filter(
    (p) =>
      p.active && !p.userId && !staff.some((s) => s.professionalId === p.id)
  );

  // Profesional vinculado al usuario que se esta editando
  const getLinkedPro = (userId: string) =>
    professionals.find((p) => p.userId === userId);

  // Filtrado y ordenamiento
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "name") cmp = a.name.localeCompare(b.name);
        else if (sortField === "email") cmp = a.email.localeCompare(b.email);
        else if (sortField === "role") cmp = a.role.localeCompare(b.role);
        else if (sortField === "active")
          cmp = Number(b.active) - Number(a.active);
        else if (sortField === "joinedAt")
          cmp = (a.joinedAt || "").localeCompare(b.joinedAt || "");
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [staff, search, sortField, sortDir]);

  const teamMembers = filtered.filter((s) => STAFF_ROLES.includes(s.role));
  const clientMembers = filtered.filter((s) => s.role === "CLIENT");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`ml-1 inline h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`}
    />
  );

  // --- Crear cuenta ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api.post<{ id: string; role: string }>(
        "/auth/users/staff",
        {
          email: createForm.email,
          password: createForm.password,
          name: createForm.name,
          phone: createForm.phone || undefined,
          role: createForm.role,
        }
      );
      if (createForm.professionalId && createForm.role === "PROFESSIONAL") {
        await api.patch(
          `/core/professionals/${createForm.professionalId}/link-user`,
          { userId: result.id }
        );
      }
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      load();
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear la cuenta"));
    } finally {
      setSaving(false);
    }
  };

  // --- Abrir edicion unificada ---
  const openEdit = (s: StaffMember) => {
    const linkedPro = getLinkedPro(s.id);
    setEditMember(s);
    setEditForm({
      name: s.name,
      email: s.email,
      phone: s.phone || "",
      newPassword: "",
      confirmPassword: "",
      role: s.role,
      active: s.active,
      professionalId: linkedPro?.id || "",
      unlinkProfessional: false,
    });
    setError("");
    setSuccess("");
  };

  // --- Guardar edicion unificada ---
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const promises: Promise<unknown>[] = [];

      // 1. Actualizar datos personales
      promises.push(
        api.patch(`/auth/users/${editMember.id}/staff`, {
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || undefined,
        })
      );

      // 2. Cambiar contrasena (si se lleno)
      if (editForm.newPassword) {
        if (editForm.newPassword !== editForm.confirmPassword) {
          throw new Error("Las contrasenas no coinciden");
        }
        promises.push(
          api.post(`/auth/users/${editMember.id}/reset-password`, {
            newPassword: editForm.newPassword,
          })
        );
      }

      // 3. Cambiar estado (activo/inactivo)
      if (
        editForm.active !== editMember.active &&
        editMember.role !== "OWNER"
      ) {
        promises.push(
          api.patch(`/auth/users/${editMember.id}/status`, {
            active: editForm.active,
          })
        );
      }

      // 4. Vincular profesional (si cambio)
      if (editForm.professionalId && editForm.role === "PROFESSIONAL") {
        const currentLinked = getLinkedPro(editMember.id);
        if (currentLinked?.id !== editForm.professionalId) {
          promises.push(
            api.patch(
              `/core/professionals/${editForm.professionalId}/link-user`,
              { userId: editMember.id }
            )
          );
        }
      }

      // 5. Desvincular profesional
      if (editForm.unlinkProfessional) {
        const currentLinked = getLinkedPro(editMember.id);
        if (currentLinked) {
          promises.push(
            api.patch(`/core/professionals/${currentLinked.id}/unlink-user`, {})
          );
        }
      }

      await Promise.all(promises);
      setEditMember(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar los cambios"));
    } finally {
      setSaving(false);
    }
  };

  // --- Confirmar desactivar/activar rapido ---
  const handleConfirmToggle = async () => {
    if (!confirmId) return;
    const member = staff.find((s) => s.id === confirmId);
    if (!member) return;
    setSaving(true);
    try {
      await api.patch(`/auth/users/${confirmId}/status`, {
        active: !member.active,
      });
      setConfirmId(null);
      load();
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // --- Tabla reutilizable ---
  function MemberTable({
    members,
    title,
    icon,
    dotColor,
  }: {
    members: StaffMember[];
    title: string;
    icon: React.ReactNode;
    dotColor: string;
  }) {
    if (members.length === 0) return null;
    return (
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
            {icon} {title} ({members.length})
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              exportCSV(members, title.toLowerCase().replace(/ /g, "_"))
            }
          >
            <Download className="h-3 w-3" /> Exportar CSV
          </Button>
        </div>
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      className="hover:text-foreground flex items-center transition-colors"
                      onClick={() => toggleSort("name")}
                    >
                      Nombre <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      className="hover:text-foreground flex items-center transition-colors"
                      onClick={() => toggleSort("email")}
                    >
                      Email <SortIcon field="email" />
                    </button>
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      className="hover:text-foreground flex items-center transition-colors"
                      onClick={() => toggleSort("role")}
                    >
                      Rol <SortIcon field="role" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      className="hover:text-foreground flex items-center transition-colors"
                      onClick={() => toggleSort("active")}
                    >
                      Estado <SortIcon field="active" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {members.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-muted/30 border-b transition-colors last:border-0 ${!s.active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {s.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-[180px] truncate font-medium">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted-foreground max-w-[200px] truncate px-4 py-3">
                      {s.email}
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                      {s.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[s.role] || "bg-gray-100 text-gray-600"}`}
                      >
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={s.active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {s.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canDo(role, "staff_edit") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => openEdit(s)}
                            title="Editar cuenta"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canDo(role, "staff_deactivate") &&
                          s.role !== "OWNER" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                              onClick={() => setConfirmId(s.id)}
                              title={s.active ? "Desactivar" : "Activar"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">
            Gestiona las cuentas de tu equipo y clientes
          </p>
        </div>
        {canDo(role, "staff_create") && (
          <Button
            onClick={() => {
              setShowCreate(true);
              setCreateForm(emptyCreateForm);
              setError("");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Crear cuenta
          </Button>
        )}
      </div>

      {/* Busqueda */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nombre, email o telefono..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <p className="text-muted-foreground py-8 text-center">Cargando...</p>
      ) : staff.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No hay cuentas de usuario registradas
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Crear primera cuenta
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No se encontraron resultados para &quot;{search}&quot;
        </p>
      ) : (
        <>
          <MemberTable
            members={teamMembers}
            title="Equipo del negocio"
            icon={<Users className="text-primary h-4 w-4" />}
            dotColor="bg-primary"
          />
          <MemberTable
            members={clientMembers}
            title="Clientes"
            icon={<UserCircle className="h-4 w-4 text-emerald-500" />}
            dotColor="bg-emerald-500"
          />
        </>
      )}

      {/* ========== MODAL: Crear cuenta ========== */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Crear cuenta de usuario"
        wide
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <p className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Juan Perez"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="juan@correo.com"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Contrasena *</Label>
              <Input
                type="password"
                placeholder="Minimo 8 caracteres"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, password: e.target.value })
                }
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                placeholder="+57 300 123 4567"
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <select
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    role: e.target.value,
                    professionalId: "",
                  })
                }
              >
                <option value="PROFESSIONAL">Profesional</option>
                <option value="RECEPTIONIST">Recepcionista</option>
                <option value="ADMIN">Administrador</option>
                <option value="CLIENT">Cliente</option>
              </select>
            </div>
            {createForm.role === "PROFESSIONAL" && unlinkedPros.length > 0 && (
              <div className="space-y-2">
                <Label>Vincular a profesional</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={createForm.professionalId}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      professionalId: e.target.value,
                    })
                  }
                >
                  <option value="">Sin vincular</option>
                  {unlinkedPros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "Sin nombre"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear cuenta"}
            </Button>
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

      {/* ========== MODAL: Editar cuenta (unificado) ========== */}
      <Dialog
        open={!!editMember}
        onClose={() => setEditMember(null)}
        title={editMember ? `Editar: ${editMember.name}` : "Editar cuenta"}
        wide
      >
        {editMember && (
          <form onSubmit={handleSaveEdit} className="space-y-6">
            {error && (
              <p className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
                {success}
              </p>
            )}

            {/* Seccion: Datos personales */}
            <div>
              <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                Datos personales
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Telefono</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Seccion: Contrasena */}
            <div>
              <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                Cambiar contrasena
              </h3>
              <p className="text-muted-foreground mb-3 text-xs">
                Deja vacio para mantener la contrasena actual.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nueva contrasena</Label>
                  <Input
                    type="password"
                    placeholder="Minimo 8 caracteres"
                    value={editForm.newPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, newPassword: e.target.value })
                    }
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar contrasena</Label>
                  <Input
                    type="password"
                    placeholder="Repetir contrasena"
                    value={editForm.confirmPassword}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    minLength={8}
                  />
                </div>
              </div>
            </div>

            {/* Seccion: Estado */}
            {editMember.role !== "OWNER" && (
              <div>
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  Estado de la cuenta
                </h3>
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editForm.active}
                      onCheckedChange={(checked) =>
                        setEditForm({ ...editForm, active: checked })
                      }
                    />
                    <p className="text-sm font-medium">
                      {editForm.active ? "Cuenta activa" : "Cuenta inactiva"}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {editForm.active
                      ? "El usuario puede iniciar sesion y usar la plataforma."
                      : "El usuario no podra iniciar sesion, pero su perfil profesional seguira activo en el equipo."}
                  </p>
                </div>
              </div>
            )}

            {/* Seccion: Vincular profesional */}
            {editMember.role === "PROFESSIONAL" &&
              (() => {
                const linkedPro = getLinkedPro(editMember.id);
                return (
                  <div>
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                      Perfil profesional
                    </h3>
                    {linkedPro ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                          <Link2 className="h-4 w-4 text-green-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Vinculado a: {linkedPro.name || "Sin nombre"}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Este usuario esta asociado al perfil profesional
                            </p>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={editForm.unlinkProfessional}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  unlinkProfessional: e.target.checked,
                                  professionalId: "",
                                })
                              }
                            />
                            <span className="text-destructive text-xs font-medium">
                              Desvincular
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Vincular a profesional</Label>
                        {unlinkedPros.length > 0 ? (
                          <select
                            className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                            value={editForm.professionalId}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                professionalId: e.target.value,
                              })
                            }
                          >
                            <option value="">Sin vincular</option>
                            {unlinkedPros.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name || "Sin nombre"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            No hay profesionales disponibles para vincular.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Botones */}
            <div className="flex gap-2 border-t pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar todos los cambios"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMember(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ========== MODAL: Confirmar activar/desactivar ========== */}
      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title={
          staff.find((s) => s.id === confirmId)?.active
            ? "Desactivar cuenta"
            : "Activar cuenta"
        }
      >
        {confirmId &&
          (() => {
            const m = staff.find((s) => s.id === confirmId);
            return m ? (
              <div>
                <p className="text-muted-foreground mb-2 text-sm">
                  {m.active ? (
                    <>
                      Estas seguro de desactivar la cuenta de{" "}
                      <strong>{m.name}</strong>?
                    </>
                  ) : (
                    <>
                      Estas seguro de activar la cuenta de{" "}
                      <strong>{m.name}</strong>?
                    </>
                  )}
                </p>
                <ul className="text-muted-foreground mb-4 list-disc space-y-1 pl-4 text-xs">
                  <li>
                    La cuenta de usuario{" "}
                    {m.active
                      ? "no podra iniciar sesion"
                      : "podra iniciar sesion nuevamente"}
                    .
                  </li>
                  {m.role === "PROFESSIONAL" && (
                    <li className="font-medium text-green-600">
                      Su perfil profesional seguira activo en el equipo del
                      negocio.
                    </li>
                  )}
                </ul>
                <div className="flex gap-2">
                  <Button
                    variant={m.active ? "destructive" : "default"}
                    onClick={handleConfirmToggle}
                    disabled={saving}
                  >
                    {saving
                      ? "Procesando..."
                      : m.active
                        ? "Si, desactivar cuenta"
                        : "Si, activar cuenta"}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null;
          })()}
      </Dialog>
    </div>
  );
}
