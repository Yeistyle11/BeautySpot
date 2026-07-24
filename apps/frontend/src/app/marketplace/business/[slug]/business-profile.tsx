"use client";

// Perfil publico de un negocio: compone las secciones activas y el acceso a reservar.
import { useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { imageUnoptimized } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Scissors,
  MapPin,
  Phone,
  Star,
  Calendar,
  ArrowLeft,
  Instagram,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { z } from "zod";
import { useApiPublic } from "@/lib/swr";

import {
  profileSchema,
  professionalSchema,
  reviewsResponseSchema,
  ratingDistributionSchema,
  SECTION_TITLES,
  type Profile,
  type Professional,
  type Review,
  type RatingDistribution,
} from "./schemas";
import { StorySection } from "./sections/story-section";
import { TeamSection } from "./sections/team-section";
import { GallerySection } from "./sections/gallery-section";
import { ReviewsSection } from "./sections/reviews-section";
import { LocationSection } from "./sections/location-section";

/**
 * Perfil publico de un negocio. Recibe `initialProfile` ya resuelto por el
 * server component: SWR lo usa como `fallbackData`, asi que el contenido va en
 * el HTML inicial (indexable) y desde ahi la pagina revalida en cliente.
 */
export default function BusinessProfile({
  slug,
  initialProfile,
}: {
  slug: string;
  initialProfile: Profile | null;
}) {
  const { data: profile, isLoading: loading } = useApiPublic<Profile>(
    `/marketplace/profiles/${slug}`,
    initialProfile ? { fallbackData: initialProfile } : undefined,
    profileSchema
  );

  const bid = profile?.businessId;
  const { data: professionals } = useApiPublic<Professional[]>(
    bid ? `/marketplace/professional-profiles/business/${bid}` : null,
    undefined,
    z.array(professionalSchema)
  );
  const { data: reviewsResp } = useApiPublic<{
    items: Review[];
    total: number;
  }>(
    bid ? `/marketplace/reviews/business/${bid}?limit=10` : null,
    undefined,
    reviewsResponseSchema
  );
  const { data: ratingDist } = useApiPublic<RatingDistribution>(
    bid ? `/marketplace/reviews/business/${bid}/summary` : null,
    undefined,
    ratingDistributionSchema
  );

  const [galleryIdx, setGalleryIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const reviews = reviewsResp?.items ?? [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-muted-foreground flex min-h-screen flex-col items-center justify-center gap-4">
        <Scissors className="h-16 w-16 opacity-20" />
        <p className="text-lg font-medium">Negocio no encontrado</p>
        <Link href="/marketplace" className="text-primary hover:underline">
          Volver al marketplace
        </Link>
      </div>
    );
  }

  const sections = profile.sectionConfig?.sections
    ?.filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order) || [
    { id: "story", enabled: true, order: 1 },
    { id: "team", enabled: true, order: 2 },
    { id: "gallery", enabled: true, order: 3 },
    { id: "reviews", enabled: true, order: 4 },
    { id: "location", enabled: true, order: 5 },
  ];

  const gallery = profile.galleryImages || [];
  const coverImg = profile.coverImage || gallery[0]?.url;

  return (
    <div className="bg-background min-h-screen">
      <div className="from-primary/30 to-primary/10 relative h-72 bg-gradient-to-br sm:h-80">
        {coverImg && (
          <Image
            src={coverImg}
            alt={profile.name}
            fill
            sizes="100vw"
            unoptimized={imageUnoptimized(coverImg)}
            priority
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <div className="absolute left-4 top-4 z-10">
          <Link href="/marketplace">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 text-white backdrop-blur hover:bg-white/30"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver
            </Button>
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-4">
              {profile.logo ? (
                <Image
                  src={profile.logo}
                  alt={profile.name}
                  width={80}
                  height={80}
                  unoptimized={imageUnoptimized(profile.logo)}
                  className="h-20 w-20 shrink-0 rounded-2xl border-4 border-white object-cover shadow-lg"
                />
              ) : (
                <div className="bg-primary text-primary-foreground flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white text-3xl font-bold shadow-lg">
                  {profile.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1 text-white">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold drop-shadow-lg">
                    {profile.name}
                  </h1>
                  {profile.verified && (
                    <Badge className="bg-primary text-primary-foreground">
                      Verificado
                    </Badge>
                  )}
                </div>
                {profile.tagline && (
                  <p className="mt-1 text-lg text-white/90 drop-shadow">
                    {profile.tagline}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/80">
                  {Number(profile.rating) > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-white">
                        {Number(profile.rating).toFixed(1)}
                      </span>
                      ({profile.totalReviews} resenas)
                    </span>
                  )}
                  {profile.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.city}
                    </span>
                  )}
                  {profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {profile.phone}
                    </span>
                  )}
                </div>
              </div>
              <Link href={`/marketplace/business/${slug}/book`}>
                <Button
                  size="lg"
                  className="text-primary hidden bg-white shadow-lg hover:bg-white/90 sm:flex"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Agendar cita
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 sm:hidden">
          <Link href={`/marketplace/business/${slug}/book`} className="block">
            <Button size="lg" className="w-full">
              <Calendar className="mr-2 h-4 w-4" />
              Agendar cita
            </Button>
          </Link>
        </div>

        {sections.map((section) => {
          const title =
            section.customTitle || SECTION_TITLES[section.id] || section.id;
          switch (section.id) {
            case "story":
              return (
                profile.storyText && (
                  <StorySection
                    key={section.id}
                    title={title}
                    storyTitle={profile.storyTitle}
                    storyText={profile.storyText}
                    storyImage={profile.storyImage}
                    foundedYear={profile.foundedYear}
                    founders={profile.founders}
                  />
                )
              );
            case "team":
              return (
                (professionals ?? []).length > 0 && (
                  <TeamSection
                    key={section.id}
                    title={title}
                    professionals={professionals ?? []}
                    slug={slug}
                  />
                )
              );
            case "gallery":
              return (
                gallery.length > 0 && (
                  <GallerySection
                    key={section.id}
                    title={title}
                    images={gallery}
                    setGalleryIdx={setGalleryIdx}
                    setLightboxOpen={setLightboxOpen}
                  />
                )
              );
            case "reviews":
              return (
                <ReviewsSection
                  key={section.id}
                  title={title}
                  reviews={reviews}
                  ratingDist={ratingDist ?? null}
                  rating={profile.rating}
                  totalReviews={profile.totalReviews}
                />
              );
            case "location":
              return (
                (profile.address || profile.city) && (
                  <LocationSection
                    key={section.id}
                    title={title}
                    address={profile.address}
                    city={profile.city}
                    state={profile.state}
                    country={profile.country}
                  />
                )
              );
            default:
              return null;
          }
        })}

        {profile.socialLinks &&
          Object.values(profile.socialLinks).some(Boolean) && (
            <div className="mb-8 flex items-center gap-3">
              {profile.socialLinks.instagram && (
                <a
                  href={profile.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-muted hover:bg-muted/80 flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              )}
              {profile.socialLinks.website && (
                <a
                  href={profile.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-muted hover:bg-muted/80 flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Sitio web
                </a>
              )}
            </div>
          )}

        <div className="from-primary to-primary/80 text-primary-foreground mb-8 rounded-2xl bg-gradient-to-r p-8 text-center">
          <h3 className="text-2xl font-bold">Listo para tu proxima cita?</h3>
          <p className="text-primary-foreground/80 mt-2">
            Agenda en segundos, sin necesidad de crear una cuenta
          </p>
          <Link href={`/marketplace/business/${slug}/book`}>
            <Button
              size="lg"
              className="text-primary mt-4 bg-white hover:bg-white/90"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Agendar cita ahora
            </Button>
          </Link>
        </div>
      </div>

      {lightboxOpen && gallery.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() =>
              setGalleryIdx((galleryIdx - 1 + gallery.length) % gallery.length)
            }
            className="absolute left-4 text-white/70 hover:text-white"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <Image
            src={gallery[galleryIdx].url}
            alt={gallery[galleryIdx].title || ""}
            width={1200}
            height={900}
            unoptimized={imageUnoptimized(gallery[galleryIdx].url)}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setGalleryIdx((galleryIdx + 1) % gallery.length)}
            className="absolute right-4 text-white/70 hover:text-white"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 text-2xl text-white/70 hover:text-white"
          >
            &times;
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {galleryIdx + 1} / {gallery.length}
          </div>
        </div>
      )}
    </div>
  );
}
