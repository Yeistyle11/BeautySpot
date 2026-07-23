import { z } from "zod";

// Contratos de las respuestas publicas del marketplace. Viven aparte porque
// los usan tanto el server component (metadata + datos iniciales) como el
// componente cliente que hidrata la pagina.

export const sectionConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  customTitle: z.string().optional(),
});

export const galleryImageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  category: z.string().optional(),
  featured: z.boolean().optional(),
});
export type GalleryImage = z.infer<typeof galleryImageSchema>;

export const socialLinksSchema = z.object({
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
});

export const profileSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  logo: z.string().nullable(),
  coverImage: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating: z.number(),
  totalReviews: z.number(),
  businessType: z.string().nullable(),
  verified: z.boolean(),
  tagline: z.string().nullable(),
  storyTitle: z.string().nullable(),
  storyText: z.string().nullable(),
  storyImage: z.string().nullable(),
  foundedYear: z.number().nullable(),
  founders: z.string().nullable(),
  socialLinks: socialLinksSchema.nullable(),
  sectionConfig: z
    .object({ sections: z.array(sectionConfigSchema) })
    .nullable(),
  galleryImages: z.array(galleryImageSchema).nullable(),
  isPublished: z.boolean(),
  profileCompleteness: z.number(),
});
export type Profile = z.infer<typeof profileSchema>;

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string(),
  photo: z.string().nullable(),
  bio: z.string().nullable(),
  specialties: z.array(z.string()),
  yearsExp: z.number(),
  tagline: z.string().nullable(),
  rating: z.number(),
  totalReviews: z.number(),
  socialInstagram: z.string().nullable(),
  portfolio: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .nullable(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const reviewSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  rating: z.number(),
  comment: z.string().nullable(),
  response: z.string().nullable(),
  respondedAt: z.string().nullable(),
  serviceName: z.string().nullable(),
  professionalName: z.string().nullable(),
  photos: z.array(z.string()).nullable(),
  isVerified: z.boolean(),
  helpfulCount: z.number(),
  createdAt: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewsResponseSchema = z.object({
  items: z.array(reviewSchema),
  total: z.number(),
});

export const ratingDistributionSchema = z.object({
  5: z.number(),
  4: z.number(),
  3: z.number(),
  2: z.number(),
  1: z.number(),
  average: z.number(),
  total: z.number(),
});
export type RatingDistribution = z.infer<typeof ratingDistributionSchema>;

export const SECTION_TITLES: Record<string, string> = {
  story: "Nuestra Historia",
  services: "Servicios",
  team: "Nuestro Equipo",
  gallery: "Galeria",
  reviews: "Resenas",
  location: "Ubicacion",
};
