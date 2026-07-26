// Esquemas Zod y tipos del perfil publico (galeria, secciones, resenas).
import { z } from "zod";

// Los campos opcionales admiten null o ausencia.

export const galleryImageSchema = z.object({
  url: z.string(),
  title: z.string().nullish(),
  category: z.string().nullish(),
  featured: z.boolean().nullish(),
});
export type GalleryImage = z.infer<typeof galleryImageSchema>;

export const sectionItemSchema = z.object({
  type: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  customTitle: z.string().nullish(),
});
export type SectionItem = z.infer<typeof sectionItemSchema>;

export const profileSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  logo: z.string().nullish(),
  coverImage: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  tagline: z.string().nullish(),
  storyTitle: z.string().nullish(),
  storyText: z.string().nullish(),
  storyImage: z.string().nullish(),
  foundedYear: z.number().nullish(),
  founders: z.string().nullish(),
  socialLinks: z
    .object({
      instagram: z.string().nullish(),
      facebook: z.string().nullish(),
      tiktok: z.string().nullish(),
      website: z.string().nullish(),
    })
    .nullish(),
  sectionConfig: z.object({ sections: z.array(sectionItemSchema) }).nullish(),
  galleryImages: z.array(galleryImageSchema).nullish(),
  isPublished: z.boolean(),
  profileCompleteness: z.number(),
});
export type Profile = z.infer<typeof profileSchema>;

export const reviewSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  rating: z.number(),
  comment: z.string().nullish(),
  response: z.string().nullish(),
  respondedAt: z.string().nullish(),
  createdAt: z.string(),
  professionalName: z.string().nullish(),
  serviceName: z.string().nullish(),
});
export type Review = z.infer<typeof reviewSchema>;

/** Secciones que el negocio puede activar y reordenar en su perfil publico. */
export const SECTION_TYPES = [
  { type: "story", label: "Nuestra Historia" },
  { type: "services", label: "Servicios" },
  { type: "team", label: "Equipo" },
  { type: "gallery", label: "Galeria" },
  { type: "reviews", label: "Resenas" },
  { type: "location", label: "Ubicacion" },
];

export const defaultSections: SectionItem[] = SECTION_TYPES.map((s, i) => ({
  type: s.type,
  enabled: true,
  order: i + 1,
}));

export const emptyConfigForm = {
  tagline: "",
  storyTitle: "",
  storyText: "",
  storyImage: "",
  foundedYear: "",
  founders: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  website: "",
};

export type ConfigForm = typeof emptyConfigForm;

export const PROFILE_KEY = "/marketplace/business-profiles";

export const TABS = [
  { id: "overview", label: "overview" },
  { id: "profile", label: "profile" },
  { id: "gallery", label: "gallery" },
  { id: "sections", label: "sections" },
  { id: "reviews", label: "reviews" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/**
 * Mueve una seccion una posicion arriba o abajo intercambiando su `order` con
 * el de la vecina. Devuelve la lista intacta si ya esta en el extremo.
 */
export function reorderSections(
  sections: SectionItem[],
  type: string,
  direction: "up" | "down"
): SectionItem[] {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((s) => s.type === type);
  if (index === -1) return sections;
  if (
    (direction === "up" && index === 0) ||
    (direction === "down" && index === sorted.length - 1)
  ) {
    return sections;
  }

  const swapWith = direction === "up" ? index - 1 : index + 1;
  const currentOrder = sorted[index].order;
  sorted[index] = { ...sorted[index], order: sorted[swapWith].order };
  sorted[swapWith] = { ...sorted[swapWith], order: currentOrder };
  return sorted;
}
