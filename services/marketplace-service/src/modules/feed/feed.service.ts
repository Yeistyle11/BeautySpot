import { Injectable } from "@nestjs/common";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { RedisCacheService } from "@beautyspot/nest-common";
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

/**
 * Vigencia del feed en caché.
 *
 * Más corta que la del perfil: el feed ordena por popularidad y novedad, así que
 * un negocio recién publicado debe aparecer pronto. No se invalida en las
 * escrituras porque cualquier alta o cambio de valoración afectaría a todas las
 * claves por ubicación; a este ritmo de cambio, caducar sale más barato que
 * recalcular.
 */
const FEED_TTL_SEGUNDOS = 60;

/** Compone el feed de la home del marketplace a partir de varias consultas curadas. */
@Injectable()
export class FeedService {
  /** Prefijo de las claves de caché del feed. */
  private static readonly PREFIJO_CACHE = "marketplace:feed:";

  constructor(
    private readonly profilesService: BusinessProfilesService,
    private readonly professionalProfilesService: ProfessionalProfilesService,
    private readonly cache: RedisCacheService
  ) {}

  /**
   * Arma el feed (categorías y secciones), personalizando "populares" por
   * ubicación si se da.
   *
   * Es la portada del marketplace: la lectura más repetida del sistema,
   * idéntica para todos los visitantes de una misma zona, y son cinco consultas
   * por visita. Va cacheada.
   */
  async getFeed(
    lat?: number,
    lng?: number,
    city?: string
  ): Promise<FeedResponse> {
    return this.cache.remember(
      `${FeedService.PREFIJO_CACHE}${this.claveUbicacion(lat, lng, city)}`,
      FEED_TTL_SEGUNDOS,
      () => this.componerFeed(lat, lng, city)
    );
  }

  /**
   * Clave de caché por ubicación.
   *
   * Las coordenadas se redondean a dos decimales (~1 km) a propósito: sin
   * redondear, cada visitante tendría su propia entrada y la caché no serviría
   * de nada, porque nunca habría dos peticiones con la misma clave.
   */
  private claveUbicacion(lat?: number, lng?: number, city?: string): string {
    if (lat !== undefined && lng !== undefined) {
      return `geo:${lat.toFixed(2)}:${lng.toFixed(2)}`;
    }
    return city ? `ciudad:${city.toLowerCase()}` : "global";
  }

  /** Composición real del feed, sin pasar por la caché. */
  private async componerFeed(
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

    // Un GROUP BY en vez de una consulta por categoría: cada una traía además
    // una fila de perfil que se descartaba, porque el listado devuelve datos y
    // total a la vez.
    const conteos = await this.profilesService.contarPorTipo();

    return categoryConfigs.map((cfg) => ({
      ...cfg,
      count: conteos.get(cfg.id) ?? 0,
    }));
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
