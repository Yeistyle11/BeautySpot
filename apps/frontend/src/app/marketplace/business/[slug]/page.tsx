// Pagina publica de un negocio (server component): obtiene el perfil por slug, arma la metadata y delega en BusinessProfile.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublic } from "@/lib/api-server";
import BusinessProfile from "./business-profile";
import { z } from "zod";
import {
  profileResponseSchema,
  servicioPublicoSchema,
  type Profile,
  type ServicioPublico,
} from "./schemas";

interface PageProps {
  // Desde Next 15 los parámetros de ruta llegan como promesa: la página puede
  // empezar a renderizarse antes de que estén resueltos.
  params: Promise<{ slug: string }>;
}

// El perfil se pide una sola vez por render y se reutiliza en generateMetadata
// y en el componente: Next deduplica los fetch identicos dentro de la peticion.
async function getProfile(slug: string): Promise<Profile | null> {
  const raw = await fetchPublic<unknown>(`/marketplace/profiles/${slug}`);
  if (!raw) return null;
  const parsed = profileResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data.profile : null;
}

// El catalogo se resuelve en servidor; si falla, lo pide el cliente.
async function getServicios(businessId: string): Promise<ServicioPublico[]> {
  const raw = await fetchPublic<unknown>(
    `/core/public/businesses/${businessId}/services`
  );
  const parsed = z.array(servicioPublicoSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Metadata propia de cada negocio: título, descripción e imagen del perfil. */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);

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

/** Perfil publico de un negocio, resuelto por slug en el servidor. */
export default async function BusinessProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();
  const servicios = await getServicios(profile.businessId);

  return (
    <BusinessProfile
      slug={slug}
      initialProfile={profile}
      initialServicios={servicios}
    />
  );
}
