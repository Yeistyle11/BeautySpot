"use client";

// Pagina de gestion del perfil publico: pestanas para editar la ficha del negocio en el marketplace.
import { useState } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Megaphone, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useApi, usePaginatedApi } from "@/lib/swr";
import { useSeededForm } from "@/lib/use-seeded-form";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import { mensajeDeError, repartirFalloAlGuardar } from "@/lib/error-message";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isNotFoundError } from "@/lib/api-error";
import { AvisoDeConflicto } from "@/components/ui/aviso-de-conflicto";
import { canDo } from "@/lib/permissions";
import { OverviewTab } from "./overview-tab";
import { emptyGalleryForm, type GalleryForm } from "./add-image-dialog";
import {
  datosDelNegocioSchema,
  defaultSections,
  emptyConfigForm,
  emptyCreateForm,
  profileSchema,
  PROFILE_KEY,
  reorderSections,
  reviewSchema,
  type ConfigForm,
  type CreateForm,
  type DatosDelNegocio,
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

/** Edicion del perfil publico del negocio, por pestañas. */
export default function MarketplacePage() {
  const toast = useToast();
  const businessId = useAuthStore((s) => s.businessId);
  const role = useAuthStore((s) => s.role);
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
  const { items: reviews, mutate: mutateReviews } = usePaginatedApi<Review>(
    reviewsKey,
    reviewSchema
  );

  const [configForm, setConfigForm] = useState<ConfigForm>(emptyConfigForm);
  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  // Version con la que se abrio el formulario: viaja en el guardado para que
  // el servidor rechace pisar lo que otra persona guardo mientras tanto.
  const [versionCargada, setVersionCargada] = useState<string | null>(null);
  const [conflictoConfig, setConflictoConfig] = useState("");

  useSeededForm(profile, (p) => {
    setVersionCargada(p.updatedAt ?? null);
    setConflictoConfig("");
    setConfigForm({
      tagline: p.tagline || "",
      storyTitle: p.storyTitle || "",
      storyText: p.storyText || "",
      storyImage: p.storyImage || "",
      foundedYear: p.foundedYear?.toString() || "",
      founders: p.founders || "",
      instagram: p.socialLinks?.instagram || "",
      facebook: p.socialLinks?.facebook || "",
      tiktok: p.socialLinks?.tiktok || "",
      website: p.socialLinks?.website || "",
    });
    setSections(p.sectionConfig?.sections || defaultSections);
  });

  // La galeria se lee del perfil en cada render: se edita con acciones puntuales
  // que revalidan (agregar/quitar), no con un formulario abierto que pisar, asi
  // que no necesita copia propia que mantener en sincronia.
  const gallery = profile?.galleryImages ?? [];

  const [galleryDialog, setGalleryDialog] = useState(false);
  const [galleryForm, setGalleryForm] = useState<GalleryForm>(emptyGalleryForm);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("overview");
  const [creando, setCreando] = useState(false);

  // Un 404 aqui no es un fallo: es un negocio que todavia no se ha publicado.
  const sinPerfil = isNotFoundError(profileError);

  // Los datos del negocio rellenan el alta, y solo se piden cuando hace falta
  // rellenarla.
  const { data: negocio } = useApi<DatosDelNegocio>(
    sinPerfil && businessId ? `/core/businesses/${businessId}` : null,
    undefined,
    datosDelNegocioSchema
  );

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

  /** Cambia lo escrito por lo que hay guardado, dejando la pestaña abierta. */
  const recargarPerfil = async () => {
    await mutateProfile();
    setConflictoConfig("");
  };

  const saveConfig = async () => {
    setSaving("config");
    setConflictoConfig("");
    try {
      await api.put("/marketplace/business-profiles/config", {
        updatedAt: versionCargada ?? undefined,
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
      repartirFalloAlGuardar(err, setConflictoConfig, toast.error);
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
        <PageHeader titulo="Marketplace" />
        <LoadingState recurso="el perfil público" />
      </div>
    );
  }

  // Que el perfil no exista y que no se haya podido cargar son dos cosas
  // distintas: de la primera se sale creandolo, y reintentar no la arregla.
  if (profileError && !sinPerfil) {
    return (
      <div>
        <PageHeader titulo="Marketplace" />
        <div>
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
        <PageHeader titulo="Marketplace" />
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
      <PageHeader
        titulo="Marketplace"
        descripcion="Perfil público y visibilidad"
        accion={
          profile.slug && (
            <Button
              variant="outline"
              onClick={() =>
                window.open(`/marketplace/business/${profile.slug}`, "_blank")
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Ver perfil público
            </Button>
          )
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          aria-label="Secciones del marketplace"
          className="mb-6 flex max-w-full gap-1 overflow-x-auto"
        >
          {TAB_IDS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="whitespace-nowrap">
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            profile={profile}
            gallery={gallery}
            role={role}
            onTogglePublish={togglePublish}
          />
        </TabsContent>

        <TabsContent value="profile">
          {conflictoConfig && (
            <AvisoDeConflicto
              mensaje={conflictoConfig}
              onRecargar={() => void recargarPerfil()}
            />
          )}
          <ProfileTab
            form={configForm}
            onChange={setConfigForm}
            onSave={saveConfig}
            saving={saving === "config"}
            role={role}
          />
        </TabsContent>

        <TabsContent value="gallery">
          <GalleryTab
            gallery={gallery}
            role={role}
            onAdd={() => setGalleryDialog(true)}
            onRemove={removeGalleryImage}
          />
        </TabsContent>

        <TabsContent value="sections">
          {conflictoConfig && (
            <AvisoDeConflicto
              mensaje={conflictoConfig}
              onRecargar={() => void recargarPerfil()}
            />
          )}
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
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsTab
            reviews={reviews}
            role={role}
            drafts={reviewDrafts}
            onDraftChange={setReviewDrafts}
            onRespond={respondToReview}
            onRemoveResponse={removeReviewResponse}
            onModerar={moderarReview}
          />
        </TabsContent>
      </Tabs>

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
