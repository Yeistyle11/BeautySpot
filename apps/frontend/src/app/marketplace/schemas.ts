// Esquemas de las respuestas públicas del marketplace (feed y búsqueda), en un
// módulo sin "use client" para que los use tanto la página como el componente.
import { z } from "zod";

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
  sections: z.array(feedSectionSchema),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

export const searchResultSchema = z.object({
  items: z.array(profileSchema),
  total: z.number(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
