// Pagina publica de un negocio (server component): obtiene el perfil por slug, arma la metadata y delega en BusinessProfile.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublic } from "@/lib/api-server";
import BusinessProfile from "./business-profile";
import { profileSchema, type Profile } from "./schemas";

interface PageProps {
  params: { slug: string };
}

// El perfil se pide una sola vez por render y se reutiliza en generateMetadata
// y en el componente: Next deduplica los fetch identicos dentro de la peticion.
async function getProfile(slug: string): Promise<Profile | null> {
  const raw = await fetchPublic<unknown>(`/marketplace/profiles/${slug}`);
  if (!raw) return null;
  const parsed = profileSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Metadata por negocio. Sin esto todos los perfiles compartian el titulo
 * generico del layout raiz, que para un marketplace significa no aparecer en
 * buscadores por el nombre del negocio.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const profile = await getProfile(params.slug);

  if (!profile) {
    return { title: "Negocio no encontrado | BeautySpot" };
  }

  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const description =
    profile.description ||
    profile.tagline ||
    `Reserva tu cita en ${profile.name}${location ? ` en ${location}` : ""}.`;
  const image = profile.coverImage || profile.logo || undefined;

  return {
    title: `${profile.name}${location ? ` - ${location}` : ""} | BeautySpot`,
    description,
    alternates: { canonical: `/marketplace/business/${profile.slug}` },
    openGraph: {
      type: "website",
      title: profile.name,
      description,
      images: image ? [{ url: image }] : undefined,
    },
    // Un perfil sin publicar no debe indexarse aunque su URL sea accesible.
    robots: profile.isPublished ? undefined : { index: false, follow: false },
  };
}

export default async function BusinessProfilePage({ params }: PageProps) {
  const profile = await getProfile(params.slug);
  if (!profile) notFound();

  return <BusinessProfile slug={params.slug} initialProfile={profile} />;
}
