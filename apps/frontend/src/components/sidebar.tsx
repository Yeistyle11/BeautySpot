"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useLogout } from "@/lib/use-logout";
import { getPagesForRole } from "@/lib/permissions";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BusinessSwitcher } from "@/components/business-switcher";
import { BranchSwitcher } from "@/components/branch-switcher";
import {
  Scissors,
  LayoutDashboard,
  Calendar,
  CalendarOff,
  Users,
  UserCog,
  UserCircle,
  DollarSign,
  Settings,
  LogOut,
  BarChart3,
  Bell,
  Megaphone,
  Wallet,
  Tag,
  LayoutGrid,
  Store,
  Receipt,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Calendar,
  CalendarOff,
  Scissors,
  Users,
  Tag,
  LayoutGrid,
  UserCog,
  UserCircle,
  DollarSign,
  Wallet,
  BarChart3,
  Megaphone,
  Bell,
  Settings,
  Store,
  Receipt,
};

/**
 * Barra de navegacion lateral del dashboard: pinta las paginas permitidas al
 * rol, el perfil, el cambio de tema y el cierre de sesion.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role } = useAuthStore();
  const cerrarSesion = useLogout();
  // El panel movil se guarda junto a la ruta en que se abrio. Navegar cambia la
  // ruta y con eso deja de estar abierto, sin importar desde donde se navegue:
  // si no, tapa la pagina recien abierta y obliga a cerrarlo a mano.
  const [panel, setPanel] = useState({ abierto: false, ruta: pathname });
  const open = panel.abierto && panel.ruta === pathname;
  const setOpen = (abierto: boolean) => setPanel({ abierto, ruta: pathname });

  const pages = getPagesForRole(role);

  const handleLogout = async () => {
    await cerrarSesion();
    router.push("/login");
  };

  return (
    <>
      {/* Barra superior solo movil: el sidebar fijo no cabe en pantallas estrechas. */}
      <div className="bg-card fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="hover:bg-accent rounded-lg p-2 transition-colors"
          aria-label="Abrir menú de navegación"
          aria-expanded={open}
          aria-controls="sidebar-nav"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
          <Scissors className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold">BeautySpot</p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar-nav"
        className={cn(
          "bg-card fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r transition-transform lg:z-40 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg">
            <Scissors className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">BeautySpot</p>
            <p className="text-muted-foreground text-xs">Panel de gestión</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="hover:bg-accent rounded-lg p-1 transition-colors lg:hidden"
            aria-label="Cerrar menú de navegación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b">
          <BusinessSwitcher />
          <BranchSwitcher />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {pages.map((page) => {
            const isActive =
              page.path === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(page.path);
            const Icon = ICON_MAP[page.icon] || LayoutDashboard;
            return (
              <Link
                key={page.path}
                href={page.path}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {page.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.name || "Usuario"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {role || ""}
              </p>
            </div>
            <ThemeToggle className="p-1" />
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
