"use client";

// Dialogo para anadir una imagen a la galeria del perfil publico.
import Image from "next/image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { imageUnoptimized } from "@/lib/image";

export const emptyGalleryForm = { url: "", title: "", category: "" };
export type GalleryForm = typeof emptyGalleryForm;

interface AddImageDialogProps {
  open: boolean;
  onClose: () => void;
  form: GalleryForm;
  onChange: (form: GalleryForm) => void;
  onSubmit: () => void;
}

/** Alta de una imagen de galeria por URL, con vista previa inmediata. */
export function AddImageDialog({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
}: AddImageDialogProps) {
  const set = (patch: Partial<GalleryForm>) => onChange({ ...form, ...patch });

  return (
    <Dialog open={open} onClose={onClose} title="Agregar imagen">
      <div className="space-y-4">
        <Field label="URL de la imagen">
          <Input
            placeholder="https://..."
            value={form.url}
            onChange={(e) => set({ url: e.target.value })}
          />
        </Field>
        {form.url && (
          <Image
            src={form.url}
            alt="Vista previa de la imagen a agregar"
            width={200}
            height={128}
            unoptimized={imageUnoptimized(form.url)}
            className="h-32 w-auto rounded-lg object-cover"
          />
        )}
        <Field label="Titulo (opcional)">
          <Input
            placeholder="Descripcion de la imagen"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        <Field label="Categoria (opcional)">
          <Input
            placeholder="Cortes, Centro de belleza, Estilo..."
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
          />
        </Field>
        <Button onClick={onSubmit} disabled={!form.url}>
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>
    </Dialog>
  );
}
