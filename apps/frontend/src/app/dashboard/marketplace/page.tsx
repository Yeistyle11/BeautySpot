"use client";

// Pagina de gestion del perfil publico: pestanas para editar la ficha del negocio en el marketplace.
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError } from "@/lib/error-message";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { EmptyState } from "@/components/ui/empty-state";
import { isNotFoundError } from "@/lib/api-error";
import { canDo } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./overview-tab";
import { emptyGalleryForm, type GalleryForm } from "./add-image-dialog";
import {
  defaultSections,
  emptyConfigForm,
  emptyCreateForm,
  profileSchema,
  PROFILE_KEY,
  reorderSections,
  reviewSchema,
  type ConfigForm,
  type CreateForm,
  type GalleryImage,
  type Profile,
  type Review,
  type SectionItem,
} from "./schemas";

// Solo el resumen se ve al entrar; las demas pestanas y el dialogo de imagen se
// descargan cuando se abren.
const ProfileTab = dynamic(() =>
  import("./profile-tab").then((m) => m.ProfileTab)
);
const GalleryTab = dynamic(() =>
  import("./gallery-tab").then((m) => m.GalleryTab)
);
const SectionsTab = dynamic(() =>
  import("./sections-tab").then((m) => m.SectionsTab)
);
const ReviewsTab = dynamic(() =>
  import("./reviews-tab").then((m) => m.ReviewsTab)
);
const AddImageDialog = dynamic(
  () => import("./add-image-dialog").then((m) => m.AddImageDialog),
  { ssr: false }
);
const CreateProfileCard = dynamic(() =>
  import("./create-profile-card").then((m) => m.CreateProfileCard)
);

const TAB_LABELS: Record<string, string> = {
  overview: "Resumen",
  profile: "Perfil",
  gallery: "Galería",
  sections: "Secciones",
  reviews: "Reseñas",
};
const TAB_IDS = Object.keys(TAB_LABELS);

export default function MarketplacePage() {
  const toast = useToast();
  const { businessId, role } = useAuthStore();
  const {
    data: profile,
    isLoading: loading,
    error: profileError,
    mutate: mutateProfile,
  } = useApi<Profile | null>(PROFILE_KEY, undefined, profileSchema.nullable());
  const [saving, setSaving] = useState<string | null>(null);

  const reviewsKey = businessId
    ? `/marketplace/reviews/business/${businessId}`
    : null;
  const { data: reviewsData, mutate: mutateReviews } = useApi<
    { items: Review[]; total: number } | Review[]
  >(
    reviewsKey,
    undefined,
    // El endpoint devuelve el arreglo crudo o { items }, segun el servicio.
    z.union([
      z.object({ items: z.array(reviewSchema), total: z.number() }),
      z.array(reviewSchema),
    ])
  );
  const reviews: Review[] = Array.isArray(reviewsData)
    ? reviewsData
    : (reviewsData?.items ?? []);

  const [configForm, setConfigForm] = useState<ConfigForm>(emptyConfigForm);
  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  // El formulario y las secciones se siembran una sola vez: las revalidaciones
  // de SWR no deben pisar lo que el usuario esta editando.
  const seeded = useRef(false);
  useEffect(() => {
    if (!profile || seeded.current) return;
    seeded.current = true;
    setConfigForm({
      tagline: profile.tagline || "",
      storyTitle: profile.storyTitle || "",
      storyText: profile.storyText || "",
      storyImage: profile.storyImage || "",
      foundedYear: profile.foundedYear?.toString() || "",
      founders: profile.founders || "",
      instagram: profile.socialLinks?.instagram || "",
      facebook: profile.socialLinks?.facebook || "",
      tiktok: profile.socialLinks?.tiktok || "",
      website: profile.socialLinks?.website || "",
    });
    setSections(profile.sectionConfig?.sections || defaultSections);
  }, [profile]);

  // La galeria si sigue al servidor en cada recarga: se edita con acciones
  // puntuales (agregar/quitar), no con un formulario abierto que pisar.
  useEffect(() => {
    if (profile) setGallery(profile.galleryImages || []);
  }, [profile]);

  const [galleryDialog, setGalleryDialog] = useState(false);
  const [galleryForm, setGalleryForm] = useState<GalleryForm>(emptyGalleryForm);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("overview");
  const [creando, setCreando] = useState(false);

  // Un 404 aqui no es un fallo: es un negocio que todavia no se ha publicado.
  const sinPerfil = isNotFoundError(profileError);

  // Los datos del negocio rellenan el alta, y solo se piden cuando hace falta
  // rellenarla.
  const { data: negocio } = useApi<{
    name?: string;
    description?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    businessType?: string;
  }>(sinPerfil && businessId ? `/core/businesses/${businessId}` : null);

  const crearPerfil = async (form: CreateForm) => {
    try {
      await api.post("/marketplace/business-profiles", {
        name: form.name,
        slug: form.slug,
        businessType: form.businessType,
        description: form.description || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
      });
      await mutateProfile();
      setCreando(false);
      toast.exito("Ya tienes perfil público; publícalo cuando quieras");
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const saveConfig = async () => {
    setSaving("config");
    try {
      await api.put("/marketplace/business-profiles/config", {
        tagline: configForm.tagline || undefined,
        storyTitle: configForm.storyTitle || undefined,
        storyText: configForm.storyText || undefined,
        storyImage: configForm.storyImage || undefined,
        foundedYear: configForm.foundedYear
          ? parseInt(configForm.foundedYear)
          : undefined,
        founders: configForm.founders || undefined,
        socialLinks: {
          instagram: configForm.instagram || undefined,
          facebook: configForm.facebook || undefined,
          tiktok: configForm.tiktok || undefined,
          website: configForm.website || undefined,
        },
        sectionConfig: sections,
      });
      await mutateProfile();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    } finally {
      setSaving(null);
    }
  };

  const togglePublish = async () => {
    if (!profile) return;
    try {
      const endpoint = profile.isPublished ? "unpublish" : "publish";
      await api.post(`/marketplace/business-profiles/${endpoint}`, {});
      await mutateProfile();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const addGalleryImage = async () => {
    try {
      await api.post("/marketplace/business-profiles/gallery", {
        images: [galleryForm],
      });
      await mutateProfile();
      setGalleryForm(emptyGalleryForm);
      setGalleryDialog(false);
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const removeGalleryImage = async (index: number) => {
    try {
      await api.delete(`/marketplace/business-profiles/gallery/${index}`);
      await mutateProfile();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  /** Publica la respuesta, o la reescribe si la reseña ya tenía una. */
  const respondToReview = async (reviewId: string, yaRespondida: boolean) => {
    const response = reviewDrafts[reviewId];
    if (!response?.trim()) return;
    const ruta = `/marketplace/reviews/${reviewId}/respond`;
    try {
      if (yaRespondida) {
        await api.patch(ruta, { response });
      } else {
        await api.post(ruta, { response });
      }
      await mutateReviews();
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  /** Oculta o vuelve a publicar una reseña. */
  const moderarReview = async (
    reviewId: string,
    status: "PUBLICADA" | "OCULTA"
  ) => {
    try {
      await api.patch(`/marketplace/reviews/${reviewId}/moderar`, { status });
      await mutateReviews();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  const removeReviewResponse = async (reviewId: string) => {
    try {
      await api.delete(`/marketplace/reviews/${reviewId}/respond`);
      await mutateReviews();
    } catch (err) {
      logger.error(err);
      toast.error(mensajeDeError(err));
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Card className="mt-4 border-0 shadow-sm">
          <CardContent className="text-muted-foreground p-8 text-center">
            Cargando perfil...
          </CardContent>
        </Card>
      </div>
    );
  }

  // Que el perfil no exista y que no se haya podido cargar son dos cosas
  // distintas: de la primera se sale creandolo, y reintentar no la arregla.
  if (profileError && !sinPerfil) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <div className="mt-4">
          <ErrorDeCarga
            error={profileError}
            recurso="los datos del perfil público"
            onReintentar={() => mutateProfile()}
          />
        </div>
      </div>
    );
  }

  if (sinPerfil || !profile) {
    const puedeCrear = canDo(role, "marketplace_edit");
    return (
      <div>
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <div className="mt-4">
          {creando ? (
            <CreateProfileCard
              inicial={{
                ...emptyCreateForm,
                name: negocio?.name ?? "",
                description: negocio?.description ?? "",
                phone: negocio?.phone ?? "",
                email: negocio?.email ?? "",
                address: negocio?.address ?? "",
                city: negocio?.city ?? "",
                businessType:
                  negocio?.businessType ?? emptyCreateForm.businessType,
              }}
              onCrear={crearPerfil}
              onCancelar={() => setCreando(false)}
            />
          ) : (
            <EmptyState
              icon={Megaphone}
              titulo="Todavía no tienes perfil público"
              descripcion={
                puedeCrear
                  ? "Crea tu ficha para aparecer en el marketplace y recibir reservas."
                  : "Cuando el dueño del negocio cree la ficha, aparecerá aquí."
              }
              accion={
                puedeCrear ? (
                  <Button onClick={() => setCreando(true)}>
                    <Megaphone className="mr-2 h-4 w-4" /> Crear perfil público
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">Perfil publico y visibilidad</p>
        </div>
        {profile.slug && (
          <Button
            variant="outline"
            onClick={() =>
              window.open(`/marketplace/business/${profile.slug}`, "_blank")
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Ver perfil publico
          </Button>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Secciones del marketplace"
        className="bg-muted mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-md p-1"
      >
        {TAB_IDS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          profile={profile}
          gallery={gallery}
          role={role}
          onTogglePublish={togglePublish}
        />
      )}

      {activeTab === "profile" && (
        <ProfileTab
          form={configForm}
          onChange={setConfigForm}
          onSave={saveConfig}
          saving={saving === "config"}
          role={role}
        />
      )}

      {activeTab === "gallery" && (
        <GalleryTab
          gallery={gallery}
          role={role}
          onAdd={() => setGalleryDialog(true)}
          onRemove={removeGalleryImage}
        />
      )}

      {activeTab === "sections" && (
        <SectionsTab
          sections={sections}
          onChange={setSections}
          onMove={(type, direction) =>
            setSections((prev) => reorderSections(prev, type, direction))
          }
          onSave={saveConfig}
          saving={saving === "config"}
          role={role}
        />
      )}

      {activeTab === "reviews" && (
        <ReviewsTab
          reviews={reviews}
          role={role}
          drafts={reviewDrafts}
          onDraftChange={setReviewDrafts}
          onRespond={respondToReview}
          onRemoveResponse={removeReviewResponse}
          onModerar={moderarReview}
        />
      )}

      <AddImageDialog
        open={galleryDialog}
        onClose={() => setGalleryDialog(false)}
        form={galleryForm}
        onChange={setGalleryForm}
        onSubmit={addGalleryImage}
      />
    </div>
  );
}
