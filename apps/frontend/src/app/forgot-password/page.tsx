"use client";

// Pagina de recuperacion: pide el email y encarga al backend el correo con el
// enlace de restablecimiento.
import { useState } from "react";
import Link from "next/link";
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
import { Scissors, MailCheck } from "lucide-react";
import { apiPublic } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";

const ERROR_ID = "forgot-error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPublic.post("/auth/forgot-password", { email });
      setEnviado(true);
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
              Recuperar contraseña
            </CardTitle>
            <CardDescription>
              {enviado
                ? "Revisa tu correo"
                : "Te enviamos un enlace para crear una nueva"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enviado ? (
              // La confirmacion no dice si el email existe: hacerlo permitiria
              // averiguar quien tiene cuenta, igual que ya evita el registro.
              <div className="space-y-4 text-center">
                <MailCheck className="text-primary mx-auto h-12 w-12" />
                <p className="text-sm">
                  Si <span className="font-medium">{email}</span> tiene una
                  cuenta, recibira un enlace para restablecer su contraseña. El
                  enlace caduca en unas horas.
                </p>
                <Link
                  href="/login"
                  className="text-primary block text-sm font-medium hover:underline"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    {loading ? "Enviando..." : "Enviar enlace"}
                  </Button>
                </form>
                <div className="text-muted-foreground mt-4 text-center text-sm">
                  <Link
                    href="/login"
                    className="text-primary font-medium hover:underline"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
