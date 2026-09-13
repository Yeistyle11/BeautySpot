"use client";

// Pagina de restablecimiento: canjea el token que llega por correo por una
// contrasena nueva. Es la URL que arma el enlace del email.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { apiPublic } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { Spinner } from "@/components/ui/spinner";
import { MarcaBeautySpot } from "@/components/ui/marca-beautyspot";
import {
  LONGITUD_MINIMA_CONTRASENA,
  MENSAJE_CONTRASENA,
  PATRON_CONTRASENA,
  REQUISITOS_DE_CONTRASENA,
} from "@beautyspot/shared-constants";

const ERROR_ID = "reset-error";
const MINIMO = LONGITUD_MINIMA_CONTRASENA;

/** Qué se sabe del enlace mientras la pantalla lo comprueba. */
type Validez = "comprobando" | "valido" | "invalido";

function ResetPasswordInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [validez, setValidez] = useState<Validez>(
    token ? "comprobando" : "invalido"
  );
  const [form, setForm] = useState({ password: "", confirmacion: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // El enlace se comprueba al abrir la pantalla.
  useEffect(() => {
    if (!token) return;
    let vigente = true;

    apiPublic
      .post<{ valido: boolean }>("/auth/reset-password/validez", { token })
      .then((r) => {
        if (vigente) setValidez(r.valido ? "valido" : "invalido");
      })
      .catch(() => {
        // Si la comprobación no llega, se deja intentar: el envío decide.
        if (vigente) setValidez("valido");
      });

    return () => {
      vigente = false;
    };
  }, [token]);

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
        <MarcaBeautySpot />

        <Card className="shadow-flat border-0">
          <CardHeader className="pb-2 text-center">
            <CardTitle as="h2" className="text-xl">
              Nueva contraseña
            </CardTitle>
            <CardDescription>
              {validez === "comprobando"
                ? "Comprobando el enlace"
                : validez === "invalido"
                  ? "El enlace no sirve"
                  : "Escribela dos veces para confirmarla"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {validez === "comprobando" ? (
              <div className="flex justify-center py-4">
                <Spinner variant="inline" className="h-8 w-8 border-4" />
              </div>
            ) : validez === "invalido" ? (
              <div className="space-y-4 text-center text-sm">
                <p role="alert" className="text-destructive">
                  Este enlace ya no sirve: los de recuperación caducan y solo se
                  usan una vez. Pide uno nuevo.
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
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-1/2 -translate-y-1/2 rounded-sm focus-visible:outline-none focus-visible:ring-2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p id="reset-pista" className="text-muted-foreground text-xs">
                    {REQUISITOS_DE_CONTRASENA}
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
                <SubmitButton
                  className="w-full"
                  label="Cambiar contraseña"
                  pendingLabel="Guardando..."
                  pending={loading}
                />
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground block text-center text-sm"
                >
                  Volver al inicio de sesión
                </Link>
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
