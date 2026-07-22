"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
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
  Users,
  Camera,
  MessageSquare,
  Clock,
  Heart,
  Quote,
} from "lucide-react";
import { z } from "zod";
import { useApiPublic } from "@/lib/swr";

const sectionConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  customTitle: z.string().optional(),
});

const galleryImageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  category: z.string().optional(),
  featured: z.boolean().optional(),
});
type GalleryImage = z.infer<typeof galleryImageSchema>;

const socialLinksSchema = z.object({
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
});

const profileSchema = z.object({
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
type Profile = z.infer<typeof profileSchema>;

const professionalSchema = z.object({
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
type Professional = z.infer<typeof professionalSchema>;

const reviewSchema = z.object({
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
type Review = z.infer<typeof reviewSchema>;

const reviewsResponseSchema = z.object({
  items: z.array(reviewSchema),
  total: z.number(),
});

const ratingDistributionSchema = z.object({
  5: z.number(),
  4: z.number(),
  3: z.number(),
  2: z.number(),
  1: z.number(),
  average: z.number(),
  total: z.number(),
});
type RatingDistribution = z.infer<typeof ratingDistributionSchema>;

const SECTION_TITLES: Record<string, string> = {
  story: "Nuestra Historia",
  services: "Servicios",
  team: "Nuestro Equipo",
  gallery: "Galeria",
  reviews: "Resenas",
  location: "Ubicacion",
};

export default function BusinessProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading: loading } = useApiPublic<Profile>(
    `/marketplace/profiles/${slug}`,
    undefined,
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
      {/* Hero Banner */}
      <div className="from-primary/30 to-primary/10 relative h-72 bg-gradient-to-br sm:h-80">
        {coverImg && (
          <Image
            src={coverImg}
            alt={profile.name}
            fill
            sizes="100vw"
            unoptimized
            priority
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Back button */}
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

        {/* Business info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-4">
              {profile.logo ? (
                <Image
                  src={profile.logo}
                  alt={profile.name}
                  width={80}
                  height={80}
                  unoptimized
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

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Mobile CTA */}
        <div className="mb-6 sm:hidden">
          <Link href={`/marketplace/business/${slug}/book`} className="block">
            <Button size="lg" className="w-full">
              <Calendar className="mr-2 h-4 w-4" />
              Agendar cita
            </Button>
          </Link>
        </div>

        {/* Dynamic sections */}
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

        {/* Social links */}
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

        {/* Final CTA */}
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

      {/* Lightbox */}
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
            unoptimized
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

function StorySection({
  title,
  storyTitle,
  storyText,
  storyImage,
  foundedYear,
  founders,
}: {
  title: string;
  storyTitle: string | null;
  storyText: string;
  storyImage: string | null;
  foundedYear: number | null;
  founders: string | null;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Quote className="text-primary h-5 w-5" />
        {title}
      </h2>
      <div className="flex flex-col gap-6 sm:flex-row">
        {storyImage && (
          <div className="shrink-0 sm:w-1/3">
            <Image
              src={storyImage}
              alt={storyTitle || "Historia"}
              width={400}
              height={300}
              unoptimized
              className="h-48 w-full rounded-xl object-cover sm:h-full"
            />
          </div>
        )}
        <div className="flex-1">
          {storyTitle && (
            <h3 className="text-primary mb-3 text-xl font-semibold">
              {storyTitle}
            </h3>
          )}
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {storyText}
          </p>
          {(foundedYear || founders) && (
            <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
              {foundedYear && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Fundado en {foundedYear}
                </span>
              )}
              {founders && <span>Fundadores: {founders}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TeamSection({
  title,
  professionals,
  slug,
}: {
  title: string;
  professionals: Professional[];
  slug: string;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Users className="text-primary h-5 w-5" />
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {professionals.map((p) => (
          <Card key={p.id} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {p.photo ? (
                  <Image
                    src={p.photo}
                    alt={p.name}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="bg-primary/10 text-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold">
                    {p.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.tagline && (
                    <p className="text-primary text-sm font-medium">
                      {p.tagline}
                    </p>
                  )}
                  {p.specialties && p.specialties.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.specialties.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-muted-foreground mt-2 flex items-center gap-3 text-sm">
                    {p.yearsExp > 0 && <span>{p.yearsExp} anos de exp.</span>}
                    {Number(p.rating) > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {Number(p.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {p.bio && (
                <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
                  {p.bio}
                </p>
              )}
              <Link
                href={`/marketplace/business/${slug}/book?professionalId=${p.id}`}
                className="mt-3 block"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <Calendar className="h-3 w-3" />
                  Agendar con {p.name.split(" ")[0]}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function GallerySection({
  title,
  images,
  setGalleryIdx,
  setLightboxOpen,
}: {
  title: string;
  images: GalleryImage[];
  setGalleryIdx: (v: number | ((prev: number) => number)) => void;
  setLightboxOpen: (v: boolean) => void;
}) {
  return (
    <section className="mb-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Camera className="text-primary h-5 w-5" />
          {title}
        </h2>
        <Badge variant="secondary">{images.length} fotos</Badge>
      </div>

      {/* Featured image */}
      {images.length > 0 && (
        <div
          className="relative mb-4 cursor-pointer overflow-hidden rounded-xl"
          onClick={() => {
            setGalleryIdx(0);
            setLightboxOpen(true);
          }}
        >
          <Image
            src={images[0].url}
            alt={images[0].title || "Galeria"}
            width={800}
            height={600}
            unoptimized
            className="h-64 w-full object-cover sm:h-80"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20">
            <Camera className="h-8 w-8 text-white opacity-0 transition-opacity hover:opacity-100" />
          </div>
        </div>
      )}

      {/* Thumbnails grid */}
      {images.length > 1 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.slice(1, 9).map((img, i) => (
            <div
              key={i}
              className="cursor-pointer overflow-hidden rounded-lg"
              onClick={() => {
                setGalleryIdx(i + 1);
                setLightboxOpen(true);
              }}
            >
              <Image
                src={img.url}
                alt={img.title || `Foto ${i + 2}`}
                width={300}
                height={300}
                unoptimized
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
            </div>
          ))}
          {images.length > 9 && (
            <div
              className="bg-muted flex cursor-pointer items-center justify-center rounded-lg"
              onClick={() => {
                setGalleryIdx(9);
                setLightboxOpen(true);
              }}
            >
              <span className="text-muted-foreground text-sm font-medium">
                +{images.length - 9} mas
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewsSection({
  title,
  reviews,
  ratingDist,
  rating,
  totalReviews,
}: {
  title: string;
  reviews: Review[];
  ratingDist: RatingDistribution | null;
  rating: number;
  totalReviews: number;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <MessageSquare className="text-primary h-5 w-5" />
        {title}
      </h2>

      {/* Rating summary */}
      <div className="mb-6 flex flex-col gap-6 sm:flex-row">
        <div className="bg-muted/50 flex flex-col items-center justify-center rounded-xl px-8 py-6">
          <div className="text-5xl font-bold">{Number(rating).toFixed(1)}</div>
          <div className="mt-1 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-5 w-5 ${
                  s <= Math.round(rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalReviews} {totalReviews === 1 ? "resena" : "resenas"}
          </p>
        </div>

        {/* Rating distribution */}
        {ratingDist && (
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingDist[
                star as keyof RatingDistribution
              ] as number;
              const pct =
                ratingDist.total > 0 ? (count / ratingDist.total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-sm">
                  <span className="w-8 text-right">{star}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            Aun no hay resenas
          </p>
        ) : (
          reviews.map((r) => (
            <Card key={r.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= r.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      {r.isVerified && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary text-xs"
                        >
                          Verificada
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                      {r.serviceName && <span>{r.serviceName}</span>}
                      {r.professionalName && (
                        <span>con {r.professionalName}</span>
                      )}
                      <span>
                        {new Date(r.createdAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  {r.helpfulCount > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Heart className="h-3 w-3" />
                      {r.helpfulCount}
                    </span>
                  )}
                </div>

                {r.comment && (
                  <p className="mt-3 text-sm leading-relaxed">{r.comment}</p>
                )}

                {r.photos && r.photos.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {r.photos.map((photo, i) => (
                      <Image
                        key={i}
                        src={photo}
                        alt=""
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}

                {/* Business response */}
                {r.response && (
                  <div className="bg-muted/50 mt-3 rounded-lg p-3">
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Respuesta del negocio
                    </p>
                    <p className="text-sm">{r.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

function LocationSection({
  title,
  address,
  city,
  state,
  country,
}: {
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}) {
  const parts = [address, city, state, country].filter(Boolean);
  const mapQuery = parts.join(", ");

  return (
    <section className="mb-12">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <MapPin className="text-primary h-5 w-5" />
        {title}
      </h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{parts.join(", ")}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1 text-sm hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver en Google Maps
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
