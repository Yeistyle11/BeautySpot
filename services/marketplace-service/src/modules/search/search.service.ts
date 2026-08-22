import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  columnaSinTildes,
  escapeLikePattern,
  parsePaginationQuery,
  sinTildes,
} from "@beautyspot/shared-utils";
import {
  distanciaEnKm,
  metadataDePaginacion,
  paginarQueryBuilder,
} from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";
import { RedisCacheService } from "@beautyspot/nest-common";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";

/** Filtros de búsqueda del marketplace: texto, ubicación, tipo, valoración mínima y paginación. */
export interface SearchFilters {
  q?: string;
  city?: string;
  businessType?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  ratingMin?: number;
  page?: number;
  limit?: number;
  type?: "business" | "professional" | "all";
}

/** Lo más ancha que puede pedirse una página del marketplace. */
const MAXIMO_POR_PAGINA = 50;

/** Prefijo de las claves de caché de la búsqueda. */
const PREFIJO_CACHE = "marketplace:busqueda:";

/**
 * Vigencia de una búsqueda cacheada, la misma que la del feed: los perfiles
 * cambian poco y un minuto de retraso en ver uno nuevo no se nota, mientras que
 * la consulta recorre el catálogo entero en cada visita.
 */
const BUSQUEDA_TTL_SEGUNDOS = 60;

/**
 * Condición de texto sobre varias columnas, ignorando tildes y mayúsculas: en
 * el marketplace "Perez" tiene que encontrar a "Pérez" igual que en el resto
 * del producto.
 *
 * Las expresiones que genera son las que indexa la migración
 * `BusquedaSinTildes`; cambiar unas sin las otras deja la búsqueda recorriendo
 * la tabla entera.
 */
function coincideElTexto(columnas: string[]): string {
  return columnas
    .map((columna) => `${columnaSinTildes(columna)} LIKE :q`)
    .join(" OR ");
}

/** El texto tal y como hay que compararlo con la columna ya normalizada. */
function patronDeTexto(texto: string): string {
  return `%${escapeLikePattern(sinTildes(texto))}%`;
}

/** Resultado paginado de una búsqueda, con los ítems y el tipo consultado. */
export type SearchResult = IPaginatedResponse<
  BusinessProfileEntity | ProfessionalProfileEntity
> & {
  type: "business" | "professional" | "all";
};

/**
 * Normaliza la paginación pedida acotando la página al tope general y el
 * tamaño al del marketplace, que es la mitad del general.
 */
function paginacionPedida(filters: SearchFilters) {
  return parsePaginationQuery({
    page: filters.page,
    limit: Math.min(filters.limit ?? MAXIMO_POR_PAGINA, MAXIMO_POR_PAGINA),
  });
}

/** Busca negocios y/o profesionales publicados aplicando texto, filtros y cercanía geográfica. */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(BusinessProfileEntity)
    private readonly repo: Repository<BusinessProfileEntity>,
    @InjectRepository(ProfessionalProfileEntity)
    private readonly proRepo: Repository<ProfessionalProfileEntity>,
    private readonly cache: RedisCacheService
  ) {}

  /**
   * Resuelve la búsqueda, sirviéndola de caché mientras siga fresca. Es el
   * endpoint público más visitado y el único listado que recorría el catálogo
   * en cada llamada.
   */
  async search(filters: SearchFilters): Promise<SearchResult> {
    return this.cache.remember(this.clave(filters), BUSQUEDA_TTL_SEGUNDOS, () =>
      this.buscar(filters)
    );
  }

  /**
   * Clave de caché de unos filtros. Las coordenadas se redondean a dos
   * decimales (~1 km) para que los visitantes de una misma zona compartan
   * entrada, igual que hace el feed.
   */
  private clave(filters: SearchFilters): string {
    const partes = [
      filters.type ?? "business",
      sinTildes(filters.q ?? ""),
      sinTildes(filters.city ?? ""),
      filters.businessType ?? "",
      filters.ratingMin ?? "",
      filters.lat === undefined ? "" : filters.lat.toFixed(2),
      filters.lng === undefined ? "" : filters.lng.toFixed(2),
      filters.radius ?? "",
      filters.page ?? 1,
      filters.limit ?? MAXIMO_POR_PAGINA,
    ];
    return `${PREFIJO_CACHE}${partes.join("|")}`;
  }

  /** Enruta la búsqueda a negocios, profesionales o ambos según el tipo pedido. */
  private async buscar(filters: SearchFilters): Promise<SearchResult> {
    const type = filters.type || "business";

    if (type === "professional") {
      return { ...(await this.searchProfessionals(filters)), type };
    }

    if (type === "all") {
      const [businesses, professionals] = await Promise.all([
        this.searchBusinesses(filters),
        this.searchProfessionals(filters),
      ]);
      // Son dos consultas independientes: la página combinada trae las dos
      // páginas seguidas y el total es la suma, de donde sale si queda algo por
      // pedir en alguna de las dos.
      const total = businesses.meta.total + professionals.meta.total;
      return {
        data: [...businesses.data, ...professionals.data],
        meta: metadataDePaginacion(businesses.meta, total),
        type,
      };
    }

    return { ...(await this.searchBusinesses(filters)), type };
  }

  /** Busca negocios publicados por texto, ciudad, tipo y valoración, ordenando por cercanía o rating. */
  private async searchBusinesses(
    filters: SearchFilters
  ): Promise<IPaginatedResponse<BusinessProfileEntity>> {
    const paginacion = paginacionPedida(filters);

    const qb = this.repo
      .createQueryBuilder("bp")
      .where("bp.active = :active", { active: true })
      .andWhere("bp.is_published = :published", { published: true });

    if (filters.q) {
      qb.andWhere(
        `(${coincideElTexto([
          "bp.name",
          "bp.description",
          "bp.city",
          "bp.tagline",
        ])})`,
        { q: patronDeTexto(filters.q) }
      );
    }

    if (filters.city) {
      qb.andWhere(`${columnaSinTildes("bp.city")} LIKE :city`, {
        city: patronDeTexto(filters.city),
      });
    }

    if (filters.businessType) {
      qb.andWhere("bp.business_type = :businessType", {
        businessType: filters.businessType,
      });
    }

    if (filters.ratingMin) {
      qb.andWhere("bp.rating >= :ratingMin", { ratingMin: filters.ratingMin });
    }

    if (filters.lat && filters.lng) {
      const radius = filters.radius || 10;
      qb.andWhere(`${distanciaEnKm("bp")} <= :radius`, {
        lat: filters.lat,
        lng: filters.lng,
        radius,
      });
      // Ordenar por la misma expresión con la que se filtró: los parámetros
      // del punto ya están puestos por el andWhere de arriba.
      qb.orderBy(distanciaEnKm("bp"), "ASC");
    } else {
      qb.orderBy("bp.rating", "DESC").addOrderBy("bp.total_reviews", "DESC");
    }

    return paginarQueryBuilder(qb, paginacion);
  }

  /** Busca profesionales visibles por texto y valoración, filtrando por ciudad vía el perfil del negocio. */
  private async searchProfessionals(
    filters: SearchFilters
  ): Promise<IPaginatedResponse<ProfessionalProfileEntity>> {
    const paginacion = paginacionPedida(filters);

    const qb = this.proRepo
      .createQueryBuilder("pp")
      .where("pp.active = :active", { active: true })
      .andWhere("pp.visible_on_profile = :visible", { visible: true });

    if (filters.q) {
      qb.andWhere(
        `(${coincideElTexto(["pp.name", "pp.bio", "pp.specialties"])})`,
        { q: patronDeTexto(filters.q) }
      );
    }

    // Filtrar por ciudad a traves del perfil del negocio
    if (filters.city) {
      qb.innerJoin(
        "business_profiles",
        "bp",
        "bp.business_id = pp.business_id"
      ).andWhere(`${columnaSinTildes("bp.city")} LIKE :city`, {
        city: patronDeTexto(filters.city),
      });
    }

    if (filters.ratingMin) {
      qb.andWhere("pp.rating >= :ratingMin", { ratingMin: filters.ratingMin });
    }

    qb.orderBy("pp.rating", "DESC").addOrderBy("pp.total_reviews", "DESC");

    return paginarQueryBuilder(qb, paginacion);
  }
}
