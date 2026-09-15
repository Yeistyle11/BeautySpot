// Esquemas de las respuestas públicas del marketplace (feed y búsqueda), en un
// módulo sin "use client" para que los use tanto la página como el componente.
import { z } from "zod";
import { paginatedSchema } from "@/lib/pagination";

export const profileSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  logo: z.string().nullable(),
  coverImage: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  businessType: z.string().nullable(),
  rating: z.number(),
  totalReviews: z.number(),
  tagline: z.string().nullable(),
  profileCompleteness: z.number(),
  galleryImages: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        featured: z.boolean().optional(),
      })
    )
    .nullable(),
  verified: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

export const feedSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["carousel", "grid"]),
  items: z.array(profileSchema),
});
export type FeedSection = z.infer<typeof feedSectionSchema>;

export const feedCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  count: z.number(),
});

export const feedResponseSchema = z.object({
  categories: z.array(feedCategorySchema),
  // El feed trae tambien una seccion de profesionales destacados, cuyos items
  // no son perfiles de negocio y que esta pantalla no pinta. Se descartan las
  // secciones que no encajan en vez de invalidar la respuesta entera: una
  // seccion que no se sabe representar no puede dejar el escaparate en blanco.
  sections: z.array(z.unknown()).transform((secciones) =>
    secciones
      .map((seccion) => feedSectionSchema.safeParse(seccion))
      .filter((r): r is { success: true; data: FeedSection } => r.success)
      .map((r) => r.data)
  ),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

export const searchResultSchema = paginatedSchema(profileSchema);
export type SearchResult = z.infer<typeof searchResultSchema>;
