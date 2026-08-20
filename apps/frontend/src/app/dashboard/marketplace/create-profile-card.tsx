"use client";

// Alta del escaparate: el formulario con el que un negocio sin perfil publico
// entra en el marketplace.
import { useId, useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { TIPOS_DE_NEGOCIO } from "@beautyspot/shared-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { emptyCreateForm, sugerirEnlace, type CreateForm } from "./schemas";

interface CreateProfileCardProps {
  /** Datos del negocio con los que arranca el formulario. */
  inicial?: Partial<CreateForm>;
  onCrear: (form: CreateForm) => Promise<void>;
  onCancelar: () => void;
}

/** Formulario de alta del perfil publico del negocio. */
export function CreateProfileCard({
  inicial,
  onCrear,
  onCancelar,
}: CreateProfileCardProps) {
  const id = useId();
  const [form, setForm] = useState<CreateForm>({
    ...emptyCreateForm,
    ...inicial,
  });
  // Mientras el dueno no toque el enlace, lo seguimos derivando del nombre: ver
  // como se forma es lo que le permite decidir si quiere otro.
  const [enlaceTocado, setEnlaceTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const enlace = enlaceTocado ? form.slug : sugerirEnlace(form.name);
  const set = (parche: Partial<CreateForm>) =>
    setForm((f) => ({ ...f, ...parche }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onCrear({ ...form, slug: enlace });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Publica tu negocio
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Con esta ficha apareces en el marketplace. Podrás completarla y
          decidir cuándo publicarla.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="space-y-4">
          <Field label="Nombre del negocio">
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Barbería La Noche"
              maxLength={120}
              required
            />
          </Field>

          <Field label="Enlace público">
            <Input
              value={enlace}
              onChange={(e) => {
                setEnlaceTocado(true);
                set({ slug: e.target.value });
              }}
              placeholder="barberia-la-noche"
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Solo minúsculas, números y guiones"
              required
            />
            <p className="text-muted-foreground mt-1 text-xs" id={`${id}-url`}>
              Tus clientes te encontrarán en /marketplace/business/
              {enlace || "tu-negocio"}
            </p>
          </Field>

          <Field label="Tipo de negocio">
            <Select
              value={form.businessType}
              onChange={(e) => set({ businessType: e.target.value })}
            >
              {TIPOS_DE_NEGOCIO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Descripción">
            <Textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Cortes clásicos y afeitado a navaja desde 1998"
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ciudad">
              <Input
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
                placeholder="Bogotá"
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="Calle 123 #45-67"
              />
            </Field>
            <Field label="Teléfono">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+57 300 1234567"
                maxLength={30}
              />
            </Field>
            <Field label="Correo">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="hola@lanoche.co"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear perfil público
            </Button>
            <Button type="button" variant="outline" onClick={onCancelar}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
