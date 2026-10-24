"use client";

// Perfil publico de un negocio: compone las secciones activas y el acceso a reservar.
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
} from "lucide-react";
import { z } from "zod";
import { useApiPublic } from "@/lib/swr";
import type { PaginationMeta } from "@/lib/pagination";
import { hrefSeguro } from "@/lib/url";

import {
  profileResponseSchema,
  reviewsResponseSchema,
  ratingDistributionSchema,
  servicioPublicoSchema,
  profesionalPublicoSchema,
  sedePublicaSchema,
  SECTION_TITLES,
  type Profile,
  type ProfileResponse,
  type Professional,
  type ProfesionalPublico,
  type SedePublica,
  type Review,
  type RatingDistribution,
  type ServicioPublico,
} from "./schemas";
import { StorySection } from "./sections/story-section";
import { ServicesSection } from "./sections/services-section";
import { TeamSection } from "./sections/team-section";
import { GallerySection } from "./sections/gallery-section";
import { ReviewsSection } from "./sections/reviews-section";
import { LocationSection } from "./sections/location-section";
import { Spinner } from "@/components/ui/spinner";

/**
 * Perfil público de un negocio. `initialProfile` llega resuelto del servidor y
 * SWR lo usa como `fallbackData` para revalidar en cliente.
 */
export default function BusinessProfile({
  slug,
  initialProfile,
  initialServicios,
}: {
  slug: string;
  initialProfile: Profile | null;
  /** Catalogo resuelto en servidor, para que entre en el HTML inicial. */
  initialServicios?: ServicioPublico[];
}) {
  // El perfil y el equipo llegan juntos en esta respuesta.
  const { data: respuesta, isLoading: loading } = useApiPublic<ProfileResponse>(
    `/marketplace/profiles/${slug}`,
    initialProfile ? { fallbackData: { profile: initialProfile } } : undefined,
    profileResponseSchema
  );
  const profile = respuesta?.profile;
  const bid = profile?.businessId;

  // Servicios y equipo se piden al core, que es donde el negocio los gestiona.
  // El escaparate del marketplace solo guarda lo personalizado.
  const { data: servicios } = useApiPublic<ServicioPublico[]>(
    bid ? `/core/public/businesses/${bid}/services` : null,
    initialServicios ? { fallbackData: initialServicios } : undefined,
    z.array(servicioPublicoSchema)
  );
  const { data: equipoDelNegocio } = useApiPublic<ProfesionalPublico[]>(
    bid ? `/core/public/businesses/${bid}/professionals` : null,
    undefined,
    z.array(profesionalPublicoSchema)
  );
  // Las sedes, para que la ficha diga todas las direcciones y no solo la del
  // negocio, que es la de una de ellas.
  const { data: sedes } = useApiPublic<SedePublica[]>(
    bid ? `/core/public/businesses/${bid}/branches` : null,
    undefined,
    z.array(sedePublicaSchema)
  );

  // El equipo personalizado del escaparate manda; si no lo hay, se pinta la
  // ficha de trabajo.
  const professionals: Professional[] = respuesta?.professionals?.length
    ? respuesta.professionals
    : (equipoDelNegocio ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        photo: p.photo ?? null,
        bio: p.bio ?? null,
        specialties: p.specialties ?? [],
        yearsExp: p.yearsExp ?? 0,
        tagline: null,
        rating: p.rating ?? 0,
        totalReviews: p.totalReviews ?? 0,
        socialInstagram: null,
        portfolio: null,
      }));
  const { data: reviewsResp } = useApiPublic<{
    data: Review[];
    meta: PaginationMeta;
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

  const reviews = reviewsResp?.data ?? [];

  // El perfil resuelto en servidor entra como `fallbackData` y se pinta desde
  // el primer render, mientras la revalidacion sigue por detras.
  if (loading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner variant="inline" className="h-8 w-8 border-4" />
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

  // Un negocio que nunca toco la configuracion no trae sectionConfig: se pinta el
  // orden por defecto, el mismo que ofrece el panel en
  // dashboard/marketplace/schemas.ts (defaultSections); los dos van a la par.
  const sections = profile.sectionConfig?.sections
    ?.filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order) || [
    { id: "story", enabled: true, order: 1 },
    { id: "services", enabled: true, order: 2 },
    { id: "team", enabled: true, order: 3 },
    { id: "gallery", enabled: true, order: 4 },
    { id: "reviews", enabled: true, order: 5 },
    { id: "location", enabled: true, order: 6 },
  ];

  const gallery = profile.galleryImages || [];
  const coverImg = profile.coverImage || gallery[0]?.url;
  const instagramHref = hrefSeguro(profile.socialLinks?.instagram);
  const websiteHref = hrefSeguro(profile.socialLinks?.website);

  return (
    <div className="bg-background min-h-screen">
      {/* En movil el nombre ocupa mas lineas: la portada crece hacia abajo en
          vez de que el bloque suba y tape «Volver». */}
      <div className="from-primary/30 to-primary/10 relative flex min-h-72 flex-col justify-end bg-gradient-to-br pt-16 sm:block sm:h-80 sm:min-h-0 sm:pt-0">
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

        {/*
          Fondo propio y no el velo del heroe: el velo tiñe abajo y aqui arriba
          es transparente, asi que el blanco quedaba sobre el degradado claro.
          Con este fondo se lee igual con foto de portada y sin ella.
        */}
        <div className="absolute left-4 top-4 z-10">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <Link href="/marketplace">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>

        <div className="relative p-4 sm:absolute sm:bottom-0 sm:left-0 sm:right-0 sm:p-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-4">
              {profile.logo ? (
                <Image
                  src={profile.logo}
                  alt={profile.name}
                  width={80}
                  height={80}
                  unoptimized={imageUnoptimized(profile.logo)}
                  className="shadow-flat h-16 w-16 shrink-0 rounded-2xl border-4 border-white object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <div className="bg-primary text-primary-foreground shadow-flat flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-4 border-white text-2xl font-bold sm:h-20 sm:w-20 sm:text-3xl">
                  {profile.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-bold drop-shadow-lg sm:text-3xl">
                    {profile.name}
                  </h1>
                  {profile.verified && (
                    <Badge className="bg-primary text-primary-foreground">
                      Verificado
                    </Badge>
                  )}
                </div>
                {profile.tagline && (
                  <p className="mt-1 text-base text-white/90 drop-shadow sm:text-lg">
                    {profile.tagline}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                  {Number(profile.rating) > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="fill-rating text-rating h-4 w-4" />
                      <span className="font-semibold text-white">
                        {Number(profile.rating).toFixed(1)}
                      </span>
                      ({profile.totalReviews} reseñas)
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
              <Button
                asChild
                size="lg"
                className="text-primary shadow-flat hidden bg-white hover:bg-white/90 sm:flex"
              >
                <Link href={`/marketplace/business/${slug}/book`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Agendar cita
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 sm:hidden">
          <Button asChild size="lg" className="w-full">
            <Link href={`/marketplace/business/${slug}/book`} className="block">
              <Calendar className="mr-2 h-4 w-4" />
              Agendar cita
            </Link>
          </Button>
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
            case "services":
              return (
                (servicios ?? []).length > 0 && (
                  <ServicesSection
                    key={section.id}
                    title={title}
                    services={servicios ?? []}
                    slug={slug}
                  />
                )
              );
            case "team":
              return (
                professionals.length > 0 && (
                  <TeamSection
                    key={section.id}
                    title={title}
                    professionals={professionals}
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
                (profile.address ||
                  profile.city ||
                  (sedes ?? []).length > 0) && (
                  <LocationSection
                    key={section.id}
                    title={title}
                    address={profile.address}
                    city={profile.city}
                    state={profile.state}
                    country={profile.country}
                    sedes={sedes ?? []}
                  />
                )
              );
            default:
              return null;
          }
        })}

        {(instagramHref || websiteHref) && (
          <div className="mb-8 flex items-center gap-3">
            {instagramHref && (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-muted hover:bg-muted/80 flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </a>
            )}
            {websiteHref && (
              <a
                href={websiteHref}
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
          <h3 className="text-2xl font-bold">Listo para tu próxima cita?</h3>
          <p className="text-primary-foreground/80 mt-2">
            Agenda en segundos, sin necesidad de crear una cuenta
          </p>
          <Button
            asChild
            size="lg"
            className="text-primary mt-4 bg-white hover:bg-white/90"
          >
            <Link href={`/marketplace/business/${slug}/book`}>
              <Calendar className="mr-2 h-4 w-4" />
              Agendar cita ahora
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
