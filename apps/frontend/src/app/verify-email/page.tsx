"use client";

// Pagina de confirmacion de cuenta: canjea el token que llega por correo. Es la
// URL que arma el enlace del email.
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { apiPublic } from "@/lib/api";
import { mensajeDeError } from "@/lib/error-message";
import { Spinner } from "@/components/ui/spinner";
import { MarcaBeautySpot } from "@/components/ui/marca-beautyspot";

type Estado = "verificando" | "confirmado" | "fallido";

function VerifyEmailInner() {
  const token = useSearchParams().get("token") ?? "";
  const [estado, setEstado] = useState<Estado>(
    token ? "verificando" : "fallido"
  );
  const [error, setError] = useState(
    token ? "" : "Este enlace no es válido. Pide uno nuevo desde el registro."
  );
  // El efecto se ejecuta dos veces en desarrollo (StrictMode) y el token es de
  // un solo uso: el segundo intento fallaria sobre una cuenta ya confirmada.
  const canjeado = useRef(false);

  useEffect(() => {
    if (!token || canjeado.current) return;
    canjeado.current = true;

    apiPublic
      .post("/auth/verify-email", { token })
      .then(() => setEstado("confirmado"))
      .catch((err) => {
        setError(mensajeDeError(err));
        setEstado("fallido");
      });
  }, [token]);

  return (
    <main className="from-primary/5 via-background to-primary/10 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <div className="w-full max-w-md">
        <MarcaBeautySpot />

        <Card className="shadow-flat border-0">
          <CardHeader className="pb-2 text-center">
            <CardTitle as="h2" className="text-xl">
              Confirmar cuenta
            </CardTitle>
            <CardDescription>
              {estado === "verificando"
                ? "Comprobando el enlace"
                : "Resultado de la confirmación"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-center text-sm">
              {estado === "verificando" && (
                <div className="flex justify-center py-4">
                  <Spinner variant="inline" className="h-8 w-8 border-4" />
                </div>
              )}
              {estado === "confirmado" && (
                <p
                  role="status"
                  className="text-success bg-success-soft rounded-lg p-3"
                >
                  Tu cuenta quedó confirmada. Ya puedes iniciar sesión.
                </p>
              )}
              {estado === "fallido" && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
              <Link
                href={estado === "confirmado" ? "/login" : "/registro"}
                className="text-primary block font-medium hover:underline"
              >
                {estado === "confirmado" ? "Iniciar sesión" : "Volver al alta"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner variant="inline" className="h-8 w-8 border-4" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
