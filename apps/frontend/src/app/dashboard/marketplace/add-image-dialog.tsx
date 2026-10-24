"use client";

// Dialogo para anadir fotos a la galeria del perfil publico.
import Image from "next/image";
import { useId, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { ZonaDeImagenes } from "@/components/ui/campo-de-imagen";

export const emptyGalleryForm = {
  urls: [] as string[],
  title: "",
  category: "",
};
export type GalleryForm = typeof emptyGalleryForm;

/** Las fotos del formulario, como las espera la galería. */
export function imagenesDeGaleria(form: GalleryForm) {
  return form.urls.map((url) => ({
    url,
    // El título describe una foto concreta: con varias, cada una lo pone luego.
    ...(form.urls.length === 1 && form.title.trim()
      ? { title: form.title.trim() }
      : {}),
    ...(form.category.trim() ? { category: form.category.trim() } : {}),
  }));
}

interface AddImageDialogProps {
  open: boolean;
  onClose: () => void;
  form: GalleryForm;
  onChange: (form: GalleryForm) => void;
  onSubmit: () => void;
  /** Fotos que todavía caben en la galería. */
  disponibles: number;
}

/** Alta de fotos de la galería: se suben, se revisan y se añaden juntas. */
export function AddImageDialog({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  disponibles,
}: AddImageDialogProps) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<GalleryForm>) => onChange({ ...form, ...patch });
  const quedan = disponibles - form.urls.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Agregar fotos"
      descripcion="Se añaden a la galería del perfil público."
      icono={ImagePlus}
      pie={
        <>
          <BotonDeCancelar />
          <Button onClick={onSubmit} disabled={form.urls.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            {form.urls.length > 1
              ? `Agregar ${form.urls.length} fotos`
              : "Agregar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={id}>Fotos</Label>
          {form.urls.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.urls.map((url, i) => (
                <li
                  key={url}
                  className="bg-muted relative aspect-square overflow-hidden rounded-lg border"
                >
                  <Image
                    src={url}
                    alt={`Foto ${i + 1} por agregar`}
                    fill
                    sizes="8rem"
                    className="object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-1 top-1 h-7 w-7 [@media(pointer:coarse)]:min-h-0 [@media(pointer:coarse)]:min-w-0"
                    onClick={() =>
                      set({ urls: form.urls.filter((otra) => otra !== url) })
                    }
                    aria-label={`Quitar la foto ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {quedan > 0 ? (
            <ZonaDeImagenes
              id={id}
              proposito="galeria"
              maximo={quedan}
              alSubir={(subidas) =>
                set({ urls: [...form.urls, ...subidas.map((s) => s.url)] })
              }
              alFallar={setError}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              La galería está completa. Quita alguna foto para agregar otras.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </div>
        {form.urls.length === 1 && (
          <Field label="Título (opcional)">
            <Input
              placeholder="Descripción de la foto"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
        )}
        <Field label="Categoría (opcional)">
          <Input
            placeholder="Cortes, Centro de belleza, Estilo..."
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
          />
        </Field>
      </div>
    </Dialog>
  );
}
