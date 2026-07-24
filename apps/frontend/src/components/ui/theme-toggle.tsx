"use client";

// Boton para alternar entre tema claro y oscuro.
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

/** Alterna entre tema claro y oscuro y recuerda la eleccion. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2",
        className
      )}
      aria-label={
        theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      }
    >
      {/* Hasta montar no se sabe el tema guardado; se muestra el sol por
          defecto para no provocar un salto visual al hidratar. */}
      {mounted && theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
