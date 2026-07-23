"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { imageUnoptimized } from "@/lib/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Scissors,
  MapPin,
  Search,
  Star,
  Sparkles,
  TrendingUp,
  Clock,
} from "lucide-react";
import { z } from "zod";
import { useApiPublic } from "@/lib/swr";

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

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  scissors: <Scissors className="h-5 w-5" />,
  mirror: <Sparkles className="h-5 w-5" />,
  spa: <Sparkles className="h-5 w-5" />,
};

const TYPE_LABELS: Record<string, string> = {
  BELLEZA: "Centro de belleza",
  SALON: " Salon de Belleza",
  SPA: "Spa",
};

/**
 * Portada del marketplace. El feed llega ya resuelto desde el servidor
 * (`initialFeed`) para que los negocios aparezcan en el HTML inicial; la
 * busqueda y el filtro por categoria siguen siendo interactivos en cliente.
 */
export default function MarketplaceFeed({
  initialFeed,
}: {
  initialFeed: FeedResponse | null;
}) {
  const { data: feed, isLoading: loading } = useApiPublic<FeedResponse>(
    "/marketplace-service/feed",
    initialFeed ? { fallbackData: initialFeed } : undefined,
    feedResponseSchema
  );
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searchParams = new URLSearchParams();
  if (search) searchParams.set("q", search);
  if (activeCategory) searchParams.set("businessType", activeCategory);
  const searchKey =
    search || activeCategory
      ? `/marketplace-service/search?${searchParams.toString()}`
      : null;
  const { data: searchResults, isLoading: searching } =
    useApiPublic<SearchResult>(searchKey, undefined, searchResultSchema);

  const isSearching = search !== "" || activeCategory !== null;

  return (
    <div className="from-background to-muted/30 min-h-screen bg-gradient-to-b">
      <div className="from-primary/10 via-background to-primary/5 relative overflow-hidden bg-gradient-to-br">
        <div className="mx-auto max-w-6xl px-4 py-16 pb-10">
          <div className="text-center">
            <div className="bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Descubre tu proximo lugar favorito
            </div>
            <h1 className="text-5xl font-bold tracking-tight">
              Beauty<span className="text-primary">Spot</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-lg">
              Explora las mejores centro de bellezas, salones y spas. Encuentra,
              compara y agenda tu cita en segundos.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nombre, ciudad o tipo..."
                className="border-muted bg-background/80 h-12 pl-12 text-base shadow-lg backdrop-blur"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {feed && feed.categories.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  !activeCategory
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                Todos
              </button>
              {feed.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setActiveCategory(activeCategory === cat.id ? null : cat.id)
                  }
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {CATEGORY_ICONS[cat.icon]}
                  {cat.name}
                  <span className="text-xs opacity-70">({cat.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          </div>
        ) : isSearching ? (
          /* Search results */
          <div>
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-2xl font-bold">Resultados</h2>
              {searchResults && (
                <Badge variant="secondary">
                  {searchResults.total} encontrados
                </Badge>
              )}
            </div>
            {searching ? (
              <div className="flex justify-center py-20">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
              </div>
            ) : searchResults && searchResults.items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.items.map((p) => (
                  <ProfileCard key={p.id} profile={p} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        ) : feed && feed.sections.length > 0 ? (
          /* Feed sections */
          <div className="space-y-12">
            {feed.sections.map((section) => (
              <FeedSection key={section.id} section={section} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function FeedSection({ section }: { section: FeedSection }) {
  const sectionIcon =
    section.id === "popular_nearby" ? (
      <TrendingUp className="text-primary h-5 w-5" />
    ) : section.id === "top_rated" ? (
      <Star className="text-primary h-5 w-5" />
    ) : (
      <Clock className="text-primary h-5 w-5" />
    );

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        {sectionIcon}
        <h2 className="text-2xl font-bold">{section.title}</h2>
      </div>
      {section.type === "carousel" ? (
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
          {section.items.map((p) => (
            <div key={p.id} className="w-72 shrink-0">
              <ProfileCard profile={p} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileCard({ profile: p }: { profile: Profile }) {
  const featuredImage =
    p.galleryImages?.find((img) => img.featured)?.url ||
    p.galleryImages?.[0]?.url ||
    p.coverImage;

  return (
    <Link href={`/marketplace/business/${p.slug}`} className="group block">
      <Card className="h-full overflow-hidden border-0 shadow-sm transition-all [contain-intrinsic-size:auto_320px] [content-visibility:auto] hover:-translate-y-0.5 hover:shadow-xl">
        <div className="from-primary/20 to-primary/5 relative h-40 bg-gradient-to-br">
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={p.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              unoptimized={imageUnoptimized(featuredImage)}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Scissors className="text-primary/30 h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {Number(p.rating) > 0 && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold shadow-sm backdrop-blur">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {Number(p.rating).toFixed(1)}
            </div>
          )}

          {p.businessType && (
            <div className="absolute bottom-3 left-3">
              <Badge className="text-foreground bg-white/90 backdrop-blur hover:bg-white/90">
                {TYPE_LABELS[p.businessType] || p.businessType}
              </Badge>
            </div>
          )}

          {p.verified && (
            <div className="bg-primary text-primary-foreground absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium">
              Verificado
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {p.logo ? (
              <Image
                src={p.logo}
                alt={p.name}
                width={44}
                height={44}
                unoptimized={imageUnoptimized(p.logo)}
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold">
                {p.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="group-hover:text-primary truncate font-semibold transition-colors">
                {p.name}
              </h3>
              {p.tagline && (
                <p className="text-muted-foreground truncate text-sm">
                  {p.tagline}
                </p>
              )}
            </div>
          </div>

          {p.description && (
            <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
              {p.description}
            </p>
          )}

          <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
            {p.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {p.city}
              </span>
            )}
            {p.totalReviews > 0 && (
              <span>
                {p.totalReviews} {p.totalReviews === 1 ? "resena" : "resenas"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground py-20 text-center">
      <Scissors className="mx-auto h-16 w-16 opacity-20" />
      <p className="mt-4 text-lg font-medium">No encontramos negocios</p>
      <p className="text-sm">Intenta con otra busqueda</p>
    </div>
  );
}
