import { z } from "zod";

export const galleryImageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  category: z.string().optional(),
  featured: z.boolean().optional(),
});
export type GalleryImage = z.infer<typeof galleryImageSchema>;

export const sectionItemSchema = z.object({
  type: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  customTitle: z.string().optional(),
});
export type SectionItem = z.infer<typeof sectionItemSchema>;

export const profileSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  logo: z.string().optional(),
  coverImage: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  tagline: z.string().optional(),
  storyTitle: z.string().optional(),
  storyText: z.string().optional(),
  storyImage: z.string().optional(),
  foundedYear: z.number().optional(),
  founders: z.string().optional(),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  sectionConfig: z.object({ sections: z.array(sectionItemSchema) }).optional(),
  galleryImages: z.array(galleryImageSchema).optional(),
  isPublished: z.boolean(),
  profileCompleteness: z.number(),
});
export type Profile = z.infer<typeof profileSchema>;

export const reviewSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  rating: z.number(),
  comment: z.string().optional(),
  response: z.string().optional(),
  respondedAt: z.string().optional(),
  createdAt: z.string(),
  professionalName: z.string().optional(),
  serviceName: z.string().optional(),
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
