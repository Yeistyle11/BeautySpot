"use client";

// Alta de cuenta. Tiene URL propia y no es un modo dentro de /login: asi se
// puede enlazar y compartir, y refrescar no devuelve al inicio de sesion.
import { Suspense } from "react";
import { AuthForm } from "../login/auth-form";
import { Spinner } from "@/components/ui/spinner";

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner variant="inline" className="h-8 w-8 border-4" />
        </div>
      }
    >
      <AuthForm modo="registro" />
    </Suspense>
  );
}
