"use client";

// Feed del marketplace: buscador y rejilla de negocios publicos.
import { useMemo, useState } from "react";
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
import { useApiPublic } from "@/lib/swr";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { TIPOS_DE_NEGOCIO } from "@beautyspot/shared-constants";
import {
  feedResponseSchema,
  searchResultSchema,
  type FeedResponse,
  type FeedSection as FeedSectionData,
  type Profile,
  type SearchResult,
} from "./schemas";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  scissors: <Scissors className="h-5 w-5" />,
  mirror: <Sparkles className="h-5 w-5" />,
  spa: <Sparkles className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
};

// Del catálogo compartido, para que la etiqueta de la tarjeta no se quede atrás
// cuando cambien los tipos que se pueden elegir al crear el negocio.
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TIPOS_DE_NEGOCIO.map((t) => [t.valor, t.etiqueta])
);

/**
 * Portada del marketplace. `initialFeed` llega resuelto del servidor; la
 * búsqueda y el filtro por categoría se resuelven en cliente.
 */
export default function MarketplaceFeed({
  initialFeed,
}: {
  initialFeed: FeedResponse | null;
}) {
  const { data: feed, isLoading: loading } = useApiPublic<FeedResponse>(
    "/marketplace/feed",
    initialFeed ? { fallbackData: initialFeed } : undefined,
    feedResponseSchema
  );
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // La busqueda va con retardo: sin el, cada tecla dispara una peticion al
  // marketplace, que es publico y no esta detras de sesion.
  const busquedaDiferida = useDebouncedValue(search);

  const searchParams = new URLSearchParams();
  if (busquedaDiferida) searchParams.set("q", busquedaDiferida);
  if (activeCategory) searchParams.set("businessType", activeCategory);
  // Sin texto ni categoria no hay busqueda: se muestra el feed de portada.
  const searchKey =
    busquedaDiferida || activeCategory
      ? `/marketplace/search?${searchParams.toString()}`
      : null;
  const { data: searchResults, isLoading: searching } =
    useApiPublic<SearchResult>(searchKey, undefined, searchResultSchema);

  const isSearching = busquedaDiferida !== "" || activeCategory !== null;

  // Con una busqueda activa los contadores se recalculan sobre lo encontrado,
  // y solo cuando han llegado todos los resultados.
  const conteosVisibles = useMemo(() => {
    if (!busquedaDiferida || !searchResults) return null;
    if (searchResults.items.length < searchResults.total) return null;

    const conteos: Record<string, number> = {};
    searchResults.items.forEach((p) => {
      if (p.businessType) {
        conteos[p.businessType] = (conteos[p.businessType] ?? 0) + 1;
      }
    });
    return conteos;
  }, [busquedaDiferida, searchResults]);

  return (
    <div className="from-background to-muted/30 min-h-screen bg-gradient-to-b">
      <div className="from-primary/10 via-background to-primary/5 relative overflow-hidden bg-gradient-to-br">
        <div className="mx-auto max-w-6xl px-4 py-16 pb-10">
          <div className="text-center">
            <div className="bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Descubre tu próximo lugar favorito
            </div>
            <h1 className="text-5xl font-bold tracking-tight">
              Beauty<span className="text-primary">Spot</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-lg">
              Explora los mejores centros de belleza, salones y spas. Encuentra,
              compara y agenda tu cita en segundos.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
              <Input
                type="search"
                aria-label="Buscar negocios por nombre, ciudad o tipo"
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
                aria-pressed={!activeCategory}
                className={`focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 ${
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
                  aria-pressed={activeCategory === cat.id}
                  className={`focus-visible:ring-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 ${
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {CATEGORY_ICONS[cat.icon]}
                  {cat.name}
                  {(() => {
                    const cuenta = conteosVisibles
                      ? (conteosVisibles[cat.id] ?? 0)
                      : busquedaDiferida
                        ? null
                        : cat.count;
                    return cuenta === null ? null : (
                      <span className="text-xs opacity-70">({cuenta})</span>
                    );
                  })()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner variant="inline" className="h-8 w-8 border-4" />
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
                <Spinner variant="inline" className="h-8 w-8 border-4" />
              </div>
            ) : searchResults && searchResults.items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.items.map((p) => (
                  <ProfileCard key={p.id} profile={p} />
                ))}
              </div>
            ) : (
              <EmptyState
                sinTarjeta
                icon={Scissors}
                className="py-20"
                titulo="No encontramos negocios"
                descripcion="Prueba con otra búsqueda o quita el filtro de categoría."
              />
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
          <EmptyState
            sinTarjeta
            icon={Scissors}
            className="py-20"
            titulo="Todavía no hay negocios publicados"
            descripcion="Estamos sumando locales a BeautySpot. Vuelve pronto."
            accion={
              <Link
                href="/registro"
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                ¿Tienes un negocio? Publícalo
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function FeedSection({ section }: { section: FeedSectionData }) {
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
                {p.totalReviews} {p.totalReviews === 1 ? "reseña" : "reseñas"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
