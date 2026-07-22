import type { Role } from "./store";

export interface PageAccess {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
}

export const PAGES: PageAccess[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN", "PROFESSIONAL"],
  },
  {
    path: "/dashboard/appointments",
    label: "Agenda",
    icon: "Calendar",
    roles: ["OWNER", "ADMIN", "PROFESSIONAL", "RECEPTIONIST"],
  },
  {
    path: "/dashboard/services",
    label: "Servicios",
    icon: "Scissors",
    roles: ["OWNER", "ADMIN", "PROFESSIONAL", "RECEPTIONIST"],
  },
  {
    path: "/dashboard/professionals",
    label: "Equipo",
    icon: "Users",
    roles: ["OWNER", "ADMIN", "PROFESSIONAL"],
  },
  {
    path: "/dashboard/categories",
    label: "Cat. Profesionales",
    icon: "Tag",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN"],
  },
  {
    path: "/dashboard/service-categories",
    label: "Cat. Servicios",
    icon: "LayoutGrid",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN"],
  },
  {
    path: "/dashboard/staff",
    label: "Usuarios",
    icon: "UserCog",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN"],
  },
  {
    path: "/dashboard/clients",
    label: "Clientes",
    icon: "UserCircle",
    roles: ["OWNER", "ADMIN", "RECEPTIONIST"],
  },
  {
    path: "/dashboard/payments",
    label: "Pagos",
    icon: "DollarSign",
    roles: ["OWNER", "ADMIN", "RECEPTIONIST"],
  },
  {
    path: "/dashboard/cash-register",
    label: "Caja",
    icon: "Wallet",
    roles: ["OWNER", "ADMIN", "RECEPTIONIST"],
  },
  {
    path: "/dashboard/analytics",
    label: "Reportes",
    icon: "BarChart3",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN"],
  },
  {
    path: "/dashboard/client",
    label: "Mi Panel",
    icon: "Calendar",
    roles: ["CLIENT"],
  },
  {
    path: "/dashboard/client/appointments",
    label: "Mis Citas",
    icon: "Scissors",
    roles: ["CLIENT"],
  },
  {
    path: "/dashboard/client/profile",
    label: "Mi Perfil",
    icon: "UserCircle",
    roles: ["CLIENT"],
  },
  {
    path: "/dashboard/marketplace",
    label: "Marketplace",
    icon: "Megaphone",
    roles: ["OWNER", "ADMIN", "CLIENT"],
  },
  {
    path: "/dashboard/notifications",
    label: "Notificaciones",
    icon: "Bell",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN", "PROFESSIONAL", "CLIENT"],
  },
  {
    path: "/dashboard/settings",
    label: "Configuracion",
    icon: "Settings",
    roles: ["SUPER_ADMIN", "OWNER", "ADMIN", "PROFESSIONAL", "CLIENT"],
  },
];

export const ACTIONS = {
  services_create: ["OWNER", "ADMIN"],
  services_edit: ["OWNER", "ADMIN"],
  services_delete: ["OWNER", "ADMIN"],
  professionals_create: ["OWNER", "ADMIN"],
  professionals_edit: ["OWNER", "ADMIN"],
  professionals_delete: ["OWNER", "ADMIN"],
  categories_create: ["OWNER", "ADMIN"],
  categories_edit: ["OWNER", "ADMIN"],
  categories_delete: ["OWNER", "ADMIN"],
  service_categories_create: ["OWNER", "ADMIN"],
  service_categories_edit: ["OWNER", "ADMIN"],
  service_categories_delete: ["OWNER", "ADMIN"],
  clients_create: ["OWNER", "ADMIN", "RECEPTIONIST"],
  clients_edit: ["OWNER", "ADMIN", "RECEPTIONIST"],
  appointments_create: ["OWNER", "ADMIN", "RECEPTIONIST"],
  appointments_confirm: ["OWNER", "ADMIN", "PROFESSIONAL"],
  appointments_cancel: ["OWNER", "ADMIN", "RECEPTIONIST"],
  payments_create: ["OWNER", "ADMIN", "RECEPTIONIST"],
  payments_edit: ["OWNER", "ADMIN"],
  payments_void: ["OWNER", "ADMIN"],
  cash_register_open: ["OWNER", "ADMIN", "RECEPTIONIST"],
  cash_register_close: ["OWNER", "ADMIN"],
  marketplace_edit: ["OWNER", "ADMIN"],
  staff_create: ["OWNER", "ADMIN", "SUPER_ADMIN"],
  staff_edit: ["OWNER", "ADMIN", "SUPER_ADMIN"],
  staff_deactivate: ["OWNER", "ADMIN", "SUPER_ADMIN"],
  staff_reset_password: ["OWNER", "ADMIN", "SUPER_ADMIN"],
  reviews_respond: ["OWNER", "ADMIN"],
  business_hours_edit: ["OWNER", "ADMIN"],
  business_edit: ["OWNER", "ADMIN"],
  settings_edit: ["OWNER"],
} as const;

export function canAccess(role: Role | null, path: string): boolean {
  if (!role) return false;
  // Ordenamos por longitud de path descendente para que el prefijo mas
  // especifico gane (ej. /dashboard/clients vs /dashboard/client), sin
  // depender del orden de declaracion en PAGES.
  const page = [...PAGES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((p) =>
      p.path === "/dashboard" ? path === "/dashboard" : path.startsWith(p.path)
    );
  if (!page) return false;
  return page.roles.includes(role);
}

export function canDo(
  role: Role | null,
  action: keyof typeof ACTIONS
): boolean {
  if (!role) return false;
  return (
    (ACTIONS[action] as readonly Role[] | undefined)?.includes(role) ?? false
  );
}

export function getPagesForRole(role: Role | null): PageAccess[] {
  if (!role) return [];
  return PAGES.filter((p) => p.roles.includes(role));
}

export function getDefaultPath(role: Role | null): string {
  const pages = getPagesForRole(role);
  return pages.length > 0 ? pages[0].path : "/dashboard";
}
