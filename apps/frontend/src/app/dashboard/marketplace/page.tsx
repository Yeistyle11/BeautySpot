"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog } from "@/components/ui/dialog";
import {
  Megaphone,
  Globe,
  Camera,
  Star,
  MessageSquare,
  ExternalLink,
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
  Instagram,
  Link2,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { canDo } from "@/lib/permissions";
import { useApi } from "@/lib/swr";

interface Profile {
  id: string;
  businessId: string;
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  phone?: string;
  email?: string;
  tagline?: string;
  storyTitle?: string;
  storyText?: string;
  storyImage?: string;
  foundedYear?: number;
  founders?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    website?: string;
  };
  sectionConfig?: { sections: SectionItem[] };
  galleryImages?: GalleryImage[];
  isPublished: boolean;
  profileCompleteness: number;
}

interface GalleryImage {
  url: string;
  title?: string;
  category?: string;
  featured?: boolean;
}

interface SectionItem {
  type: string;
  enabled: boolean;
  order: number;
  customTitle?: string;
}

interface Review {
  id: string;
  clientId: string;
  rating: number;
  comment?: string;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  professionalName?: string;
  serviceName?: string;
}

const SECTION_TYPES = [
  { type: "story", label: "Nuestra Historia" },
  { type: "services", label: "Servicios" },
  { type: "team", label: "Equipo" },
  { type: "gallery", label: "Galeria" },
  { type: "reviews", label: "Resenas" },
  { type: "location", label: "Ubicacion" },
];

const defaultSections: SectionItem[] = SECTION_TYPES.map((s, i) => ({
  type: s.type,
  enabled: true,
  order: i + 1,
}));

const PROFILE_KEY = "/marketplace/business-profiles";

export default function MarketplacePage() {
  const { businessId, role } = useAuthStore();
  const {
    data: profile,
    isLoading: loading,
    mutate: mutateProfile,
  } = useApi<Profile | null>(PROFILE_KEY);
  const [saving, setSaving] = useState<string | null>(null);

  const reviewsKey = businessId
    ? `/marketplace/reviews/business/${businessId}`
    : null;
  const { data: reviewsData, mutate: mutateReviews } = useApi<
    { items: Review[]; total: number } | Review[]
  >(reviewsKey);
  const reviews: Review[] = Array.isArray(reviewsData)
    ? reviewsData
    : (reviewsData?.items ?? []);

  const [configForm, setConfigForm] = useState({
    tagline: "",
    storyTitle: "",
    storyText: "",
    storyImage: "",
    foundedYear: "",
    founders: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",
  });
  const [sections, setSections] = useState<SectionItem[]>(defaultSections);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  useEffect(() => {
    if (profile) {
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
      setGallery(profile.galleryImages || []);
    }
  }, [profile]);

  const [galleryDialog, setGalleryDialog] = useState(false);
  const [galleryForm, setGalleryForm] = useState({
    url: "",
    title: "",
    category: "",
  });

  const [reviewResponse, setReviewResponse] = useState<Record<string, string>>(
    {}
  );
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
      console.error(err);
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
      console.error(err);
    }
  };

  const addGalleryImage = async () => {
    try {
      await api.post("/marketplace/business-profiles/gallery", {
        images: [
          {
            url: galleryForm.url,
            title: galleryForm.title,
            category: galleryForm.category,
          },
        ],
      });
      await mutateProfile();
      setGalleryForm({ url: "", title: "", category: "" });
      setGalleryDialog(false);
    } catch (err) {
      console.error(err);
    }
  };

  const removeGalleryImage = async (index: number) => {
    try {
      await api.delete(`/marketplace/business-profiles/gallery/${index}`);
      await mutateProfile();
    } catch (err) {
      console.error(err);
    }
  };

  const respondToReview = async (reviewId: string) => {
    const response = reviewResponse[reviewId];
    if (!response?.trim()) return;
    try {
      await api.post(`/marketplace/reviews/${reviewId}/respond`, { response });
      await mutateReviews();
      setReviewResponse((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateSectionOrder = (type: string, direction: "up" | "down") => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.type === type);
    if (
      (direction === "up" && idx === 0) ||
      (direction === "down" && idx === sorted.length - 1)
    )
      return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const tempOrder = sorted[idx].order;
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
    sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };
    setSections(sorted);
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
      <div className="mb-6 flex items-center justify-between">
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

      {/* Navigation tabs */}
      <div className="bg-muted mb-6 flex w-fit gap-1 rounded-md p-1">
        {["overview", "profile", "gallery", "sections", "reviews"].map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview"
                ? "Estado"
                : tab === "profile"
                  ? "Perfil"
                  : tab === "gallery"
                    ? "Galeria"
                    : tab === "sections"
                      ? "Secciones"
                      : "Resenas"}
            </button>
          )
        )}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{profile.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    /{profile.slug}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={profile.isPublished ? "success" : "secondary"}
                  >
                    {profile.isPublished ? "Publicado" : "No publicado"}
                  </Badge>
                  {canDo(role, "marketplace_edit") && (
                    <Button
                      onClick={togglePublish}
                      variant={profile.isPublished ? "outline" : "default"}
                    >
                      {profile.isPublished ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" /> Despublicar
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" /> Publicar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Completitud del perfil
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {profile.profileCompleteness}%
                  </span>
                </div>
                <Progress value={profile.profileCompleteness} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div
                    className={`rounded p-2 ${profile.name && profile.description ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {profile.name && profile.description ? (
                      <CheckCircle className="mr-1 inline h-3 w-3" />
                    ) : null}{" "}
                    Datos basicos
                  </div>
                  <div
                    className={`rounded p-2 ${profile.storyText ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {profile.storyText ? (
                      <CheckCircle className="mr-1 inline h-3 w-3" />
                    ) : null}{" "}
                    Historia
                  </div>
                  <div
                    className={`rounded p-2 ${gallery.length >= 3 ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {gallery.length >= 3 ? (
                      <CheckCircle className="mr-1 inline h-3 w-3" />
                    ) : null}{" "}
                    Galeria (3+)
                  </div>
                  <div
                    className={`rounded p-2 ${profile.socialLinks?.instagram ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {profile.socialLinks?.instagram ? (
                      <CheckCircle className="mr-1 inline h-3 w-3" />
                    ) : null}{" "}
                    Redes sociales
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile config tab */}
      {activeTab === "profile" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              Configuracion del perfil inmersivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tagline (max 80 caracteres)</Label>
              <Input
                maxLength={80}
                placeholder="La mejor experiencia en centro de belleza..."
                value={configForm.tagline}
                onChange={(e) =>
                  setConfigForm({ ...configForm, tagline: e.target.value })
                }
              />
              <p className="text-muted-foreground text-xs">
                {configForm.tagline.length}/80
              </p>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Nuestra Historia</h4>
              <div className="space-y-2">
                <Label>Titulo</Label>
                <Input
                  placeholder="Como empezamos..."
                  value={configForm.storyTitle}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, storyTitle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Texto de la historia</Label>
                <Textarea
                  placeholder="Cuenta la historia de tu negocio..."
                  value={configForm.storyText}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, storyText: e.target.value })
                  }
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Imagen de la historia (URL)</Label>
                <Input
                  placeholder="https://..."
                  value={configForm.storyImage}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, storyImage: e.target.value })
                  }
                />
                {configForm.storyImage && (
                  <img
                    src={configForm.storyImage}
                    alt="Story"
                    className="mt-2 h-32 w-auto rounded-lg object-cover"
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ano de fundacion</Label>
                <Input
                  type="number"
                  placeholder="2020"
                  value={configForm.foundedYear}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      foundedYear: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fundadores</Label>
                <Input
                  placeholder="Juan Perez, Maria Garcia"
                  value={configForm.founders}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, founders: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Redes sociales</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" /> Instagram
                  </Label>
                  <Input
                    placeholder="@usuario"
                    value={configForm.instagram}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        instagram: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Facebook
                  </Label>
                  <Input
                    placeholder="facebook.com/..."
                    value={configForm.facebook}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, facebook: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" /> TikTok
                  </Label>
                  <Input
                    placeholder="@usuario"
                    value={configForm.tiktok}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, tiktok: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Sitio web
                  </Label>
                  <Input
                    placeholder="https://..."
                    value={configForm.website}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, website: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <Button onClick={saveConfig} disabled={saving === "config"}>
              {saving === "config" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar configuracion
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Gallery tab */}
      {activeTab === "gallery" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Galeria ({gallery.length} imagenes)
              </CardTitle>
              <Button size="sm" onClick={() => setGalleryDialog(true)}>
                <Plus className="mr-2 h-4 w-4" /> Agregar imagen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {gallery.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <Camera className="mx-auto h-12 w-12 opacity-20" />
                <p className="mt-2">
                  Agrega imagenes para hacer tu perfil mas atractivo
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.map((img, i) => (
                  <div
                    key={i}
                    className="bg-muted group relative aspect-square overflow-hidden rounded-lg border"
                  >
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.title || `Imagen ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="text-muted-foreground h-8 w-8 opacity-30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeGalleryImage(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {img.title && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                        <p className="truncate text-xs text-white">
                          {img.title}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sections tab */}
      {activeTab === "sections" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Secciones del perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...sections]
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const label =
                  SECTION_TYPES.find((s) => s.type === section.type)?.label ||
                  section.type;
                return (
                  <div
                    key={section.type}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => updateSectionOrder(section.type, "up")}
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => updateSectionOrder(section.type, "down")}
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        &#9660;
                      </button>
                    </div>
                    <Switch
                      checked={section.enabled}
                      onCheckedChange={(checked) =>
                        setSections(
                          sections.map((s) =>
                            s.type === section.type
                              ? { ...s, enabled: checked }
                              : s
                          )
                        )
                      }
                    />
                    <span className="flex-1 text-sm font-medium">{label}</span>
                    <Input
                      placeholder="Titulo personalizado (opcional)"
                      value={section.customTitle || ""}
                      onChange={(e) =>
                        setSections(
                          sections.map((s) =>
                            s.type === section.type
                              ? { ...s, customTitle: e.target.value }
                              : s
                          )
                        )
                      }
                      className="h-8 max-w-48 text-sm"
                    />
                  </div>
                );
              })}
            <Button onClick={saveConfig} disabled={saving === "config"}>
              {saving === "config" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar secciones
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reviews tab */}
      {activeTab === "reviews" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              Resenas ({reviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <Star className="mx-auto h-12 w-12 opacity-20" />
                <p className="mt-2">Aun no tienes resenas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {new Date(review.createdAt).toLocaleDateString(
                            "es-CO"
                          )}
                        </span>
                      </div>
                      {review.serviceName && (
                        <Badge variant="secondary">{review.serviceName}</Badge>
                      )}
                    </div>
                    {review.comment && (
                      <p className="text-sm">{review.comment}</p>
                    )}

                    {review.response ? (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-muted-foreground mb-1 text-xs font-medium">
                          Tu respuesta:
                        </p>
                        <p className="text-sm">{review.response}</p>
                      </div>
                    ) : canDo(role, "reviews_respond") ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Responder a esta resena..."
                          value={reviewResponse[review.id] || ""}
                          onChange={(e) =>
                            setReviewResponse({
                              ...reviewResponse,
                              [review.id]: e.target.value,
                            })
                          }
                          rows={2}
                        />
                        <Button
                          size="sm"
                          onClick={() => respondToReview(review.id)}
                          disabled={!reviewResponse[review.id]?.trim()}
                        >
                          <MessageSquare className="mr-2 h-3 w-3" /> Responder
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gallery add dialog */}
      <Dialog
        open={galleryDialog}
        onClose={() => setGalleryDialog(false)}
        title="Agregar imagen"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>URL de la imagen</Label>
            <Input
              placeholder="https://..."
              value={galleryForm.url}
              onChange={(e) =>
                setGalleryForm({ ...galleryForm, url: e.target.value })
              }
            />
          </div>
          {galleryForm.url && (
            <img
              src={galleryForm.url}
              alt="Preview"
              className="h-32 w-auto rounded-lg object-cover"
            />
          )}
          <div className="space-y-2">
            <Label>Titulo (opcional)</Label>
            <Input
              placeholder="Descripcion de la imagen"
              value={galleryForm.title}
              onChange={(e) =>
                setGalleryForm({ ...galleryForm, title: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria (opcional)</Label>
            <Input
              placeholder="Cortes, Centro de belleza, Estilo..."
              value={galleryForm.category}
              onChange={(e) =>
                setGalleryForm({ ...galleryForm, category: e.target.value })
              }
            />
          </div>
          <Button onClick={addGalleryImage} disabled={!galleryForm.url}>
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
