"use client";
import { useId } from "react";
import Image from "next/image";
import { Globe, Instagram, Link2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { canDo } from "@/lib/permissions";
import { imageUnoptimized } from "@/lib/image";
import type { Role } from "@/lib/store";
import type { ConfigForm } from "./schemas";

/** Campo de red social: icono + etiqueta asociada al input. */
function SocialField({
  icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        {icon} {label}
      </Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ProfileTabProps {
  form: ConfigForm;
  onChange: (form: ConfigForm) => void;
  onSave: () => void;
  saving: boolean;
  role: Role | null;
}

/** Historia, datos de fundacion y redes del perfil publico. */
export function ProfileTab({
  form,
  onChange,
  onSave,
  saving,
  role,
}: ProfileTabProps) {
  const set = (patch: Partial<ConfigForm>) => onChange({ ...form, ...patch });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">
          Configuracion del perfil inmersivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field
          label="Tagline (max 80 caracteres)"
          hint={`${form.tagline.length}/80`}
        >
          <Input
            maxLength={80}
            placeholder="La mejor experiencia en centro de belleza..."
            value={form.tagline}
            onChange={(e) => set({ tagline: e.target.value })}
          />
        </Field>

        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium">Nuestra Historia</h4>
          <Field label="Titulo">
            <Input
              placeholder="Como empezamos..."
              value={form.storyTitle}
              onChange={(e) => set({ storyTitle: e.target.value })}
            />
          </Field>
          <Field label="Texto de la historia">
            <Textarea
              placeholder="Cuenta la historia de tu negocio..."
              value={form.storyText}
              onChange={(e) => set({ storyText: e.target.value })}
              rows={5}
            />
          </Field>
          <Field label="Imagen de la historia (URL)">
            <Input
              placeholder="https://..."
              value={form.storyImage}
              onChange={(e) => set({ storyImage: e.target.value })}
            />
          </Field>
          {form.storyImage && (
            <Image
              src={form.storyImage}
              alt="Vista previa de la imagen de la historia"
              width={200}
              height={128}
              unoptimized={imageUnoptimized(form.storyImage)}
              className="h-32 w-auto rounded-lg object-cover"
            />
          )}
        </div>

        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <Field label="Ano de fundacion">
            <Input
              type="number"
              placeholder="2020"
              value={form.foundedYear}
              onChange={(e) => set({ foundedYear: e.target.value })}
            />
          </Field>
          <Field label="Fundadores">
            <Input
              placeholder="Juan Perez, Maria Garcia"
              value={form.founders}
              onChange={(e) => set({ founders: e.target.value })}
            />
          </Field>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium">Redes sociales</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <SocialField
              icon={<Instagram className="h-4 w-4" />}
              label="Instagram"
              placeholder="@usuario"
              value={form.instagram}
              onChange={(instagram) => set({ instagram })}
            />
            <SocialField
              icon={<Globe className="h-4 w-4" />}
              label="Facebook"
              placeholder="facebook.com/..."
              value={form.facebook}
              onChange={(facebook) => set({ facebook })}
            />
            <SocialField
              icon={<Link2 className="h-4 w-4" />}
              label="TikTok"
              placeholder="@usuario"
              value={form.tiktok}
              onChange={(tiktok) => set({ tiktok })}
            />
            <SocialField
              icon={<Globe className="h-4 w-4" />}
              label="Sitio web"
              placeholder="https://..."
              value={form.website}
              onChange={(website) => set({ website })}
            />
          </div>
        </div>

        {canDo(role, "marketplace_edit") && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar configuracion
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
