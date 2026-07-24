"use client";

// Pagina de gestion del perfil publico: pestanas para editar la ficha del negocio en el marketplace.
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useApi } from "@/lib/swr";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";
import { GalleryTab } from "./gallery-tab";
import { SectionsTab } from "./sections-tab";
import { ReviewsTab } from "./reviews-tab";
import {
  AddImageDialog,
  emptyGalleryForm,
  type GalleryForm,
} from "./add-image-dialog";
import {
  defaultSections,
  emptyConfigForm,
  profileSchema,
  PROFILE_KEY,
  reorderSections,
  reviewSchema,
  type ConfigForm,
  type GalleryImage,
  type Profile,
  type Review,
  type SectionItem,
} from "./schemas";

const TAB_LABELS: Record<string, string> = {
  overview: "Resumen",
  profile: "Perfil",
  gallery: "Galeria",
  sections: "Secciones",
  reviews: "Resenas",
};
const TAB_IDS = Object.keys(TAB_LABELS);

export default function MarketplacePage() {
  const { businessId, role } = useAuthStore();
  const {
    data: profile,
    isLoading: loading,
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
        sectionConfig: { sections },
      });
      await mutateProfile();
    } catch (err) {
      logger.error(err);
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
    }
  };

  const removeGalleryImage = async (index: number) => {
    try {
      await api.delete(`/marketplace/business-profiles/gallery/${index}`);
      await mutateProfile();
    } catch (err) {
      logger.error(err);
    }
  };

  const respondToReview = async (reviewId: string) => {
    const response = reviewDrafts[reviewId];
    if (!response?.trim()) return;
    try {
      await api.post(`/marketplace/reviews/${reviewId}/respond`, { response });
      await mutateReviews();
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
    } catch (err) {
      logger.error(err);
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

  if (!profile) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Card className="mt-4 border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Megaphone className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-2 font-medium">Perfil no disponible</p>
            <p className="text-muted-foreground text-sm">
              Primero configura tu negocio en la seccion de Configuracion para
              activar tu perfil en el marketplace.
            </p>
          </CardContent>
        </Card>
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
