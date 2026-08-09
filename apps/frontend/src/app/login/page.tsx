"use client";

// Pagina de inicio de sesion. El formulario lo comparte con /registro.
import { Suspense } from "react";
import { AuthForm } from "./auth-form";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner variant="inline" className="h-8 w-8 border-4" />
        </div>
      }
    >
      <AuthForm modo="login" />
    </Suspense>
  );
}
