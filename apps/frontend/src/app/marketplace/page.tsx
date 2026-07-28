// Pagina publica del marketplace (server component): carga el feed inicial de negocios y define la metadata SEO.
import type { Metadata } from "next";
import { fetchPublic } from "@/lib/api-server";
import MarketplaceFeed from "./marketplace-feed";
import { feedResponseSchema, type FeedResponse } from "./schemas";

export const metadata: Metadata = {
  title: "Marketplace de belleza | BeautySpot",
  description:
    "Explora barberías, salones de belleza, spas y centros estéticos. Compara servicios, lee reseñas y agenda tu cita en segundos.",
  alternates: { canonical: "/marketplace" },
  openGraph: {
    type: "website",
    title: "Marketplace de belleza | BeautySpot",
    description:
      "Explora barberías, salones de belleza, spas y centros estéticos cerca de ti.",
  },
};

export default async function MarketplacePage() {
  const raw = await fetchPublic<unknown>("/marketplace/feed");
  const parsed = raw ? feedResponseSchema.safeParse(raw) : null;
  const initialFeed: FeedResponse | null = parsed?.success ? parsed.data : null;

  return <MarketplaceFeed initialFeed={initialFeed} />;
}
