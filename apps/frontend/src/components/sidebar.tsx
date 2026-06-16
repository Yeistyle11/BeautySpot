"use client";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { getPagesForRole } from "@/lib/permissions";
import { Scissors, LayoutDashboard, Calendar, Users, UserCog, CreditCard, Settings, LogOut, BarChart3, Bell, Megaphone, Wallet, Shield, Tag, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Calendar, Scissors, Users: UserCog, UserCircle: Users,
  UserCog: Shield, DollarSign: CreditCard, BarChart3, Bell, Megaphone, Settings, Wallet, Tag, LayoutGrid,
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, logout } = useAuthStore();

  const pages = getPagesForRole(role);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Scissors className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold">BeautySpot</h2>
          <p className="text-[10px] text-muted-foreground">Panel de gestion</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {pages.map((page) => {
          const isActive = page.path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(page.path);
          const Icon = ICON_MAP[page.icon] || LayoutDashboard;
          return (
            <button
              key={page.path}
              onClick={() => router.push(page.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {page.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "Usuario"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{role || ""}</p>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors" title="Cerrar sesion">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
