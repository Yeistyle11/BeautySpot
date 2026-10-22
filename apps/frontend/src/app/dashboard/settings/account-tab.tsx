"use client";

// Pestana de cuenta: datos personales y contrasena del usuario.
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { CambiarContrasena } from "@/components/cambiar-contrasena";

interface AccountTabProps {
  email: string;
  account: { name: string; phone: string };
  onAccountChange: (account: { name: string; phone: string }) => void;
  onSaveAccount: () => void;
  savingAccount: boolean;
}

/** Datos personales y cambio de contrasena del usuario que ha iniciado sesion. */
export function AccountTab({
  email,
  account,
  onAccountChange,
  onSaveAccount,
  savingAccount,
}: AccountTabProps) {
  return (
    <>
      <Card className="shadow-flat border-0">
        <CardHeader>
          <CardTitle className="text-lg">Mi cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={account.name}
                onChange={(e) =>
                  onAccountChange({ ...account, name: e.target.value })
                }
              />
            </Field>
            {/* El email identifica la cuenta; cambiarlo exige reverificacion,
                que todavia no existe. */}
            <Field label="Email">
              <Input defaultValue={email} disabled />
            </Field>
            <Field label="Teléfono">
              <Input
                value={account.phone}
                onChange={(e) =>
                  onAccountChange({ ...account, phone: e.target.value })
                }
              />
            </Field>
          </div>
          <Button onClick={onSaveAccount} disabled={savingAccount}>
            {savingAccount ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </CardContent>
      </Card>

      <CambiarContrasena className="mt-6" />
    </>
  );
}
