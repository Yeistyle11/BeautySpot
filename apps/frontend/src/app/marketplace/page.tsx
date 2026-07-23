import type { Metadata } from "next";
import { fetchPublic } from "@/lib/api-server";
import MarketplaceFeed, {
  feedResponseSchema,
  type FeedResponse,
} from "./marketplace-feed";

export const metadata: Metadata = {
  title: "Marketplace de belleza | BeautySpot",
  description:
    "Explora barberias, salones de belleza, spas y centros esteticos. Compara servicios, lee resenas y agenda tu cita en segundos.",
  alternates: { canonical: "/marketplace" },
  openGraph: {
    type: "website",
    title: "Marketplace de belleza | BeautySpot",
    description:
      "Explora barberias, salones de belleza, spas y centros esteticos cerca de ti.",
  },
};

export default async function MarketplacePage() {
  const raw = await fetchPublic<unknown>("/marketplace-service/feed");
  const parsed = raw ? feedResponseSchema.safeParse(raw) : null;
  const initialFeed: FeedResponse | null = parsed?.success ? parsed.data : null;

  return <MarketplaceFeed initialFeed={initialFeed} />;
}
