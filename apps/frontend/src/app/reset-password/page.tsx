"use client";

// Pagina de restablecimiento: canjea el token que llega por correo por una
// contrasena nueva. Es la URL que arma el enlace del email.
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scissors, Eye, EyeOff } from "lucide-react";
import { apiPublic } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { Spinner } from "@/components/ui/spinner";
import {
  LONGITUD_MINIMA_CONTRASENA,
  MENSAJE_CONTRASENA,
  PATRON_CONTRASENA,
} from "@beautyspot/shared-constants";

const ERROR_ID = "reset-error";
const MINIMO = LONGITUD_MINIMA_CONTRASENA;

function ResetPasswordInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [form, setForm] = useState({ password: "", confirmacion: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmacion) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (!PATRON_CONTRASENA.test(form.password)) {
      setError(MENSAJE_CONTRASENA);
      return;
    }
    setLoading(true);
    try {
      await apiPublic.post("/auth/reset-password", {
        token,
        newPassword: form.password,
      });
      router.push("/login?restablecida=1");
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="from-primary/5 via-background to-primary/10 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl shadow-lg">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-foreground text-2xl font-bold">BeautySpot</h1>
            <p className="text-muted-foreground text-xs">
              Gestión para tu negocio
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-2 text-center">
            <CardTitle as="h2" className="text-xl">
              Nueva contraseña
            </CardTitle>
            <CardDescription>
              Escribela dos veces para confirmarla
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="space-y-4 text-center text-sm">
                <p>
                  Este enlace no es valido. Pide uno nuevo desde la pantalla de
                  recuperacion.
                </p>
                <Link
                  href="/forgot-password"
                  className="text-primary block font-medium hover:underline"
                >
                  Recuperar contraseña
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="********"
                      minLength={MINIMO}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      required
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? ERROR_ID : "reset-pista"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      aria-pressed={showPassword}
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-1/2 -translate-y-1/2 rounded focus-visible:outline-none focus-visible:ring-2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p id="reset-pista" className="text-muted-foreground text-xs">
                    Minimo {MINIMO} caracteres, con mayusculas, minusculas y
                    numeros
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmacion">Repetir contraseña</Label>
                  <Input
                    id="confirmacion"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    minLength={MINIMO}
                    value={form.confirmacion}
                    onChange={(e) =>
                      setForm({ ...form, confirmacion: e.target.value })
                    }
                    required
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? ERROR_ID : undefined}
                  />
                </div>
                {error && (
                  <p
                    id={ERROR_ID}
                    role="alert"
                    className="text-destructive text-center text-sm"
                  >
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Guardando..." : "Cambiar contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner variant="inline" className="h-8 w-8 border-4" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
