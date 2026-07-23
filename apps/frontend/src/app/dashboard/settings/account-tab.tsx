"use client";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import type { Feedback } from "./schemas";

interface AccountTabProps {
  email: string;
  account: { name: string; phone: string };
  onAccountChange: (account: { name: string; phone: string }) => void;
  onSaveAccount: () => void;
  savingAccount: boolean;
  password: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  onPasswordChange: (password: AccountTabProps["password"]) => void;
  onChangePassword: () => void;
  savingPassword: boolean;
  passwordFeedback: Feedback | null;
  role: Role | null;
}

/** Datos personales y cambio de contrasena del usuario que ha iniciado sesion. */
export function AccountTab({
  email,
  account,
  onAccountChange,
  onSaveAccount,
  savingAccount,
  password,
  onPasswordChange,
  onChangePassword,
  savingPassword,
  passwordFeedback,
  role,
}: AccountTabProps) {
  const canSave = canDo(role, "settings_edit");

  return (
    <>
      <Card className="border-0 shadow-sm">
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
            <Field label="Telefono">
              <Input
                value={account.phone}
                onChange={(e) =>
                  onAccountChange({ ...account, phone: e.target.value })
                }
              />
            </Field>
          </div>
          {canSave && (
            <Button onClick={onSaveAccount} disabled={savingAccount}>
              {savingAccount ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Cambiar contrasena</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contrasena actual">
              <Input
                type="password"
                value={password.currentPassword}
                onChange={(e) =>
                  onPasswordChange({
                    ...password,
                    currentPassword: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Nueva contrasena">
              <Input
                type="password"
                value={password.newPassword}
                onChange={(e) =>
                  onPasswordChange({ ...password, newPassword: e.target.value })
                }
                minLength={8}
              />
            </Field>
            <Field label="Confirmar contrasena">
              <Input
                type="password"
                value={password.confirmPassword}
                onChange={(e) =>
                  onPasswordChange({
                    ...password,
                    confirmPassword: e.target.value,
                  })
                }
                minLength={8}
              />
            </Field>
          </div>
          {passwordFeedback && (
            <p
              role="status"
              className={
                passwordFeedback.type === "error"
                  ? "text-destructive bg-destructive/10 rounded-lg p-3 text-sm"
                  : "bg-success-soft text-success-soft-foreground rounded-lg p-3 text-sm"
              }
            >
              {passwordFeedback.message}
            </p>
          )}
          <Button
            variant="outline"
            onClick={onChangePassword}
            disabled={savingPassword}
          >
            {savingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Cambiar contrasena
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
