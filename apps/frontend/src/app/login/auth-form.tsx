"use client";

// Formulario compartido por /login y /registro: autentica o da de alta, guarda
// la sesion y redirige segun el rol. Las dos rutas comparten pantalla pero cada
// una tiene su URL, para poder enlazar el alta y que refrescar no la pierda.
import { useState } from "react";
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
import { useAuthStore, type Role } from "@/lib/store";
import { apiPublic } from "@/lib/api";
import { canAccess, getDefaultPath } from "@/lib/permissions";
import { authResponseSchema } from "@/lib/auth";
import { mensajeDeError } from "@/lib/error-message";

const ERROR_ID = "auth-error";

/** Minimo que exige el backend; se anuncia antes de fallar, no despues. */
const MINIMO_CONTRASENA = 8;

export type ModoAuth = "login" | "registro";

const emptyForm = {
  email: "",
  password: "",
  confirmacion: "",
  name: "",
  phone: "",
};

/**
 * Comprueba el formulario antes de enviarlo.
 *
 * Es propia y no la del navegador, para que los mensajes sean los mismos que
 * en el resto de la aplicación.
 */
function validar(form: typeof emptyForm, modo: ModoAuth): string {
  if (!form.email.trim()) return "Escribe tu email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return "El email no tiene un formato valido";
  }
  if (!form.password) return "Escribe tu contraseña";

  if (modo === "registro") {
    if (!form.name.trim()) return "Escribe tu nombre";
    if (form.password.length < MINIMO_CONTRASENA) {
      return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres`;
    }
    if (form.password !== form.confirmacion) {
      return "Las contraseñas no coinciden";
    }
  }
  return "";
}

export function AuthForm({ modo }: { modo: ModoAuth }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, setBusinessId, setRole } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const esLogin = modo === "login";
  const next = searchParams.get("next");
  const destinoAlterno = next ? `?next=${encodeURIComponent(next)}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = validar(form, modo);
    if (problema) {
      setError(problema);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const endpoint = esLogin ? "/auth/login" : "/auth/register";
      const body = esLogin
        ? { email: form.email, password: form.password }
        : {
            email: form.email,
            password: form.password,
            name: form.name,
            phone: form.phone || undefined,
          };
      const raw = await apiPublic.post<unknown>(endpoint, body);
      const parsed = authResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error("Respuesta inválida del servidor al iniciar sesión");
      }
      const data = parsed.data;
      setAuth(data.user);
      // El token es httpOnly y no se puede descifrar aquí: el rol y el negocio
      // con los que se entra los devuelve el gateway junto al usuario.
      let role: Role | null = null;
      if (data.session?.businessId) setBusinessId(data.session.businessId);
      if (data.session?.role) {
        setRole(data.session.role);
        role = data.session.role;
      }
      router.push(next && canAccess(role, next) ? next : getDefaultPath(role));
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
              {esLogin ? "Bienvenido de vuelta" : "Crear cuenta"}
            </CardTitle>
            <CardDescription>
              {esLogin
                ? "Ingresa tus datos para continuar"
                : "Registra tu cuenta nueva"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams.get("restablecida") && (
              <p
                role="status"
                className="text-success bg-success-soft mb-4 rounded-lg p-3 text-center text-sm"
              >
                Tu contraseña se cambió. Ya puedes entrar con ella.
              </p>
            )}
            {/* `noValidate`: la validación la hace `validar`, con el estilo de
                la aplicación en vez de los globos del navegador. */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {!esLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    placeholder="Tu nombre"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? ERROR_ID : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    aria-invalid={error ? true : undefined}
                    aria-describedby={
                      error ? ERROR_ID : esLogin ? undefined : "pista-password"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
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
                {!esLogin && (
                  <p
                    id="pista-password"
                    className="text-muted-foreground text-xs"
                  >
                    Mínimo {MINIMO_CONTRASENA} caracteres
                  </p>
                )}
              </div>
              {!esLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmacion">Repetir contraseña</Label>
                  <Input
                    id="confirmacion"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={form.confirmacion}
                    onChange={(e) =>
                      setForm({ ...form, confirmacion: e.target.value })
                    }
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? ERROR_ID : undefined}
                  />
                </div>
              )}
              {esLogin && (
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-primary text-sm hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}
              {!esLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono (opcional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+57 300 1234567"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              )}
              {/* El hueco está siempre reservado para que el botón no se
                  desplace al aparecer el mensaje. */}
              <p
                id={ERROR_ID}
                role="alert"
                aria-live="polite"
                className="text-destructive min-h-[1.25rem] text-center text-sm"
              >
                {error}
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Cargando..."
                  : esLogin
                    ? "Iniciar sesión"
                    : "Crear cuenta"}
              </Button>
            </form>
            <div className="text-muted-foreground mt-4 text-center text-sm">
              {esLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <Link
                href={
                  esLogin
                    ? `/registro${destinoAlterno}`
                    : `/login${destinoAlterno}`
                }
                className="text-primary font-medium hover:underline"
              >
                {esLogin ? "Regístrate" : "Inicia sesión"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
