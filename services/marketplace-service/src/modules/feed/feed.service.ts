import { Injectable } from "@nestjs/common";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";

/** Sección del feed: un bloque (carrusel o rejilla) de negocios o profesionales. */
export interface FeedSection {
  id: string;
  title: string;
  type: "carousel" | "grid";
  itemType: "business" | "professional";
  items: BusinessProfileEntity[] | ProfessionalProfileEntity[];
}

/** Categoría del feed (tipo de negocio) con su recuento de perfiles publicados. */
export interface FeedCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

/** Respuesta del feed de la home del marketplace: categorías y secciones curadas. */
export interface FeedResponse {
  categories: FeedCategory[];
  sections: FeedSection[];
}

/** Compone el feed de la home del marketplace a partir de varias consultas curadas. */
@Injectable()
export class FeedService {
  constructor(
    private readonly profilesService: BusinessProfilesService,
    private readonly professionalProfilesService: ProfessionalProfilesService
  ) {}

  /** Arma el feed (categorías y secciones), personalizando "populares" por ubicación si se da. */
  async getFeed(
    lat?: number,
    lng?: number,
    city?: string
  ): Promise<FeedResponse> {
    // Categorias disponibles
    const categories = await this.getCategories();

    // Secciones curadas en paralelo
    const [popular, topRated, recent, topProfessionals] = await Promise.all([
      this.getPopularNearby(lat, lng, city),
      this.getTopRated(),
      this.getRecent(),
      this.getTopProfessionals(),
    ]);

    const sections: FeedSection[] = [];

    if (popular.length > 0) {
      sections.push({
        id: "popular_nearby",
        title: lat && lng ? "Populares cerca de ti" : "Populares",
        type: "carousel",
        itemType: "business",
        items: popular,
      });
    }

    if (topRated.length > 0) {
      sections.push({
        id: "top_rated",
        title: "Mejor calificados",
        type: "grid",
        itemType: "business",
        items: topRated,
      });
    }

    if (topProfessionals.length > 0) {
      sections.push({
        id: "top_professionals",
        title: "Profesionales destacados",
        type: "carousel",
        itemType: "professional",
        items: topProfessionals,
      });
    }

    if (recent.length > 0) {
      sections.push({
        id: "new_on_platform",
        title: "Recien llegados a BeautySpot",
        type: "carousel",
        itemType: "business",
        items: recent,
      });
    }

    return { categories, sections };
  }

  /** Devuelve las categorías de negocio con su número de perfiles publicados. */
  private async getCategories(): Promise<FeedCategory[]> {
    const categoryConfigs = [
      { id: "BARBERIA", name: "Barberías", icon: "scissors" },
      { id: "SALON", name: "Salones de Belleza", icon: "mirror" },
      { id: "SPA", name: "Spas y Centros Estéticos", icon: "spa" },
    ];

    const categories: FeedCategory[] = [];
    for (const cfg of categoryConfigs) {
      const { total } = await this.profilesService.findPublished({
        businessType: cfg.id,
        limit: 1,
        page: 1,
      });
      categories.push({ ...cfg, count: total });
    }
    return categories;
  }

  /** Negocios populares (mejor valorados) dentro de un radio de la ubicación o ciudad. */
  private async getPopularNearby(
    lat?: number,
    lng?: number,
    city?: string
  ): Promise<BusinessProfileEntity[]> {
    const { items } = await this.profilesService.findPublished({
      lat,
      lng,
      city,
      radius: 25,
      limit: 10,
      page: 1,
      orderBy: "rating",
    });
    return items;
  }

  /** Los negocios mejor calificados de la plataforma. */
  private async getTopRated(): Promise<BusinessProfileEntity[]> {
    return this.profilesService.findTopRated(6);
  }

  /** Los negocios llegados en los últimos 30 días. */
  private async getRecent(): Promise<BusinessProfileEntity[]> {
    return this.profilesService.findRecent(30, 6);
  }

  /** Los profesionales destacados de la plataforma. */
  private async getTopProfessionals(): Promise<ProfessionalProfileEntity[]> {
    return this.professionalProfilesService.findTopRated(6);
  }
}
