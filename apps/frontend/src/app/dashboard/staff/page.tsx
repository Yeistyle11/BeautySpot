"use client";

// Pagina de usuarios: gestion de miembros del equipo (alta, edicion, baja y exportacion).
import { useMemo, useState, useDeferredValue } from "react";
import { mutate } from "swr";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Search, Users, UserCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/utils";
import { useApi } from "@/lib/swr";
import { useCrudResource } from "@/lib/use-crud-resource";
import { logger } from "@/lib/logger";
import { MemberTable } from "./member-table";
import { CreateMemberDialog } from "./create-member-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import {
  createMember,
  filterAndSortStaff,
  saveMemberChanges,
} from "./use-staff-mutations";
import {
  emptyCreateForm,
  emptyEditForm,
  professionalSchema,
  staffMemberSchema,
  STAFF_ROLES,
  type Professional,
  type SortDir,
  type SortField,
  type StaffMember,
} from "./schemas";

const STAFF_KEY = "/auth/users/business";
const PROFESSIONALS_KEY = "/core/professionals";

export default function StaffPage() {
  const { role } = useAuthStore();
  const {
    items: staff,
    isLoading: loading,
    reload: reloadStaff,
  } = useCrudResource<StaffMember>({
    listKey: STAFF_KEY,
    basePath: "/auth/users/staff",
    schema: z.array(staffMemberSchema),
  });
  const { data: professionalsData } = useApi<Professional[]>(
    PROFESSIONALS_KEY,
    undefined,
    z.array(professionalSchema)
  );
  const professionals = professionalsData ?? [];

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = () => Promise.all([reloadStaff(), mutate(PROFESSIONALS_KEY)]);

  const confirmMember = staff.find((s) => s.id === confirmId) ?? null;

  // Un profesional es vinculable solo si esta activo y todavia no tiene cuenta.
  const unlinkedPros = professionals.filter(
    (p) =>
      p.active && !p.userId && !staff.some((s) => s.professionalId === p.id)
  );

  const getLinkedPro = (userId: string) =>
    professionals.find((p) => p.userId === userId);

  const filtered = useMemo(
    () => filterAndSortStaff(staff, deferredSearch, sortField, sortDir),
    [staff, deferredSearch, sortField, sortDir]
  );

  const teamMembers = filtered.filter((s) => STAFF_ROLES.includes(s.role));
  const clientMembers = filtered.filter((s) => s.role === "CLIENT");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDir("asc");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createMember(createForm);
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear la cuenta"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (member: StaffMember) => {
    setEditMember(member);
    setEditForm({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      newPassword: "",
      confirmPassword: "",
      role: member.role,
      active: member.active,
      professionalId: getLinkedPro(member.id)?.id || "",
      unlinkProfessional: false,
    });
    setError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    setError("");
    try {
      await saveMemberChanges(
        editMember,
        editForm,
        getLinkedPro(editMember.id)
      );
      setEditMember(null);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar los cambios"));
      // Alguna de las llamadas puede haberse aplicado: se recargan los datos
      // para que la tabla refleje el estado real.
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmMember) return;
    setSaving(true);
    try {
      await api.patch(`/auth/users/${confirmMember.id}/status`, {
        active: !confirmMember.active,
      });
      setConfirmId(null);
      await reload();
    } catch (err) {
      logger.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
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

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nombre, email o telefono..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar cuentas"
          />
        </div>
      </div>

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
            role={role}
            sortField={sortField}
            onToggleSort={toggleSort}
            onEdit={openEdit}
            onRequestToggle={setConfirmId}
          />
          <MemberTable
            members={clientMembers}
            title="Clientes"
            icon={<UserCircle className="h-4 w-4 text-emerald-500" />}
            dotColor="bg-emerald-500"
            role={role}
            sortField={sortField}
            onToggleSort={toggleSort}
            onEdit={openEdit}
            onRequestToggle={setConfirmId}
          />
        </>
      )}

      <CreateMemberDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        form={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        unlinkedPros={unlinkedPros}
        saving={saving}
        error={error}
      />

      <EditMemberDialog
        member={editMember}
        onClose={() => setEditMember(null)}
        form={editForm}
        onChange={setEditForm}
        onSubmit={handleSaveEdit}
        linkedPro={editMember ? getLinkedPro(editMember.id) : undefined}
        unlinkedPros={unlinkedPros}
        saving={saving}
        error={error}
      />

      <ConfirmDialog
        open={!!confirmMember}
        onClose={() => setConfirmId(null)}
        onConfirm={handleConfirmToggle}
        title={confirmMember?.active ? "Desactivar cuenta" : "Activar cuenta"}
        confirmLabel={
          confirmMember?.active ? "Si, desactivar cuenta" : "Si, activar cuenta"
        }
        pending={saving}
        variant={confirmMember?.active ? "destructive" : "default"}
      >
        {confirmMember && (
          <>
            <p className="mb-2">
              Estas seguro de {confirmMember.active ? "desactivar" : "activar"}{" "}
              la cuenta de <strong>{confirmMember.name}</strong>?
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs">
              <li>
                La cuenta de usuario{" "}
                {confirmMember.active
                  ? "no podra iniciar sesion"
                  : "podra iniciar sesion nuevamente"}
                .
              </li>
              {confirmMember.role === "PROFESSIONAL" && (
                <li className="text-success font-medium">
                  Su perfil profesional seguira activo en el equipo del negocio.
                </li>
              )}
            </ul>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
