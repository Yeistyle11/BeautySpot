"use client";

// Layout publico del marketplace: barra superior con acceso o identidad del usuario.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Scissors, LogIn, User, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useLogout } from "@/lib/use-logout";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, user, hydrate, hydrated } = useAuthStore();
  const cerrarSesion = useLogout();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // El menu se cierra al pulsar fuera y con Escape; sin lo segundo, quien navega
  // con teclado no tiene forma de descartarlo.
  useEffect(() => {
    function alPulsarFuera(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    function alPulsarTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        botonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", alPulsarFuera);
    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("mousedown", alPulsarFuera);
      document.removeEventListener("keydown", alPulsarTecla);
    };
  }, []);

  const isAuthenticated = hydrated && !!role && !!user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/marketplace" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg">
              <Scissors className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold">BeautySpot</span>
          </Link>
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                ref={botonRef}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                className="hover:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">
                  {user!.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{user!.name}</span>
              </button>
              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-48 rounded-lg border bg-white py-1 shadow-lg"
                >
                  <Link
                    href="/dashboard/client"
                    role="menuitem"
                    className="hover:bg-accent flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Mi Panel
                  </Link>
                  <button
                    role="menuitem"
                    onClick={async () => {
                      await cerrarSesion();
                      setDropdownOpen(false);
                    }}
                    className="hover:bg-accent flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Iniciar sesion
            </Link>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="text-muted-foreground border-t bg-white py-6 text-center text-sm">
        <p>
          BeautySpot — Plataforma de gestion para centro de bellezas y salones
          de belleza
        </p>
      </footer>
    </div>
  );
}
