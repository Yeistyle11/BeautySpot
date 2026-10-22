"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { mensajeDeError } from "@/lib/error-message";
import { cn } from "@/lib/utils";

interface Aviso {
  tipo: "error" | "exito";
  mensaje: string;
}

const VACIO = { actual: "", nueva: "", confirmacion: "" };

/** Tarjeta para que quien ha iniciado sesión cambie su contraseña. */
export function CambiarContrasena({ className }: { className?: string }) {
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const cambiar = async () => {
    setAviso(null);
    if (form.nueva !== form.confirmacion) {
      setAviso({ tipo: "error", mensaje: "Las contraseñas no coinciden" });
      return;
    }
    setGuardando(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.actual,
        newPassword: form.nueva,
      });
      setForm(VACIO);
      setAviso({ tipo: "exito", mensaje: "Contraseña actualizada" });
    } catch (err) {
      logger.error(err);
      setAviso({
        tipo: "error",
        mensaje: mensajeDeError(err, "No se pudo actualizar la contraseña"),
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className={cn("shadow-flat border-0", className)}>
      <CardHeader>
        <CardTitle className="text-lg">Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contraseña actual">
            <Input
              type="password"
              autoComplete="current-password"
              value={form.actual}
              onChange={(e) => setForm({ ...form, actual: e.target.value })}
            />
          </Field>
          <Field label="Nueva contraseña">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.nueva}
              onChange={(e) => setForm({ ...form, nueva: e.target.value })}
              minLength={8}
            />
          </Field>
          <Field label="Confirmar contraseña">
            <Input
              type="password"
              autoComplete="new-password"
              value={form.confirmacion}
              onChange={(e) =>
                setForm({ ...form, confirmacion: e.target.value })
              }
              minLength={8}
            />
          </Field>
        </div>
        {aviso && (
          <p
            role="status"
            className={
              aviso.tipo === "error"
                ? "text-destructive bg-destructive/10 rounded-lg p-3 text-sm"
                : "bg-success-soft text-success-soft-foreground rounded-lg p-3 text-sm"
            }
          >
            {aviso.mensaje}
          </p>
        )}
        <Button variant="outline" onClick={cambiar} disabled={guardando}>
          {guardando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Cambiar contraseña
        </Button>
      </CardContent>
    </Card>
  );
}
