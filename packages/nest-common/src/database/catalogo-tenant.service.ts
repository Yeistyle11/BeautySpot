import { ConflictException, NotFoundException } from "@nestjs/common";
import { FindOptionsWhere, Repository } from "typeorm";
import { contieneTexto, paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";

/** Forma mínima de una entidad de catálogo: nombre, orden y baja lógica. */
export interface EntidadDeCatalogo {
  id: string;
  businessId: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

/**
 * CRUD de un catálogo de un negocio: alta con nombre único, listado ordenado,
 * baja lógica y reordenación, siempre acotados al negocio.
 */
export abstract class CatalogoTenantService<T extends EntidadDeCatalogo> {
  protected constructor(
    protected readonly repo: Repository<T>,
    /** Cómo se nombra el elemento en los mensajes dirigidos al usuario. */
    private readonly textos: { singular: string; conArticulo: string }
  ) {}

  /** Crea un elemento rechazando nombres duplicados dentro del negocio. */
  async create(businessId: string, dto: Partial<T>): Promise<T> {
    await this.asegurarNombreLibre(businessId, dto.name!);
    const creado = this.repo.create({
      ...dto,
      businessId,
    } as never) as unknown as T;
    return this.repo.save(creado as never) as unknown as Promise<T>;
  }

  /** Lista los elementos del negocio (por defecto solo activos), ordenados. */
  async findByBusiness(businessId: string, activeOnly = true): Promise<T[]> {
    const where = { businessId } as FindOptionsWhere<T>;
    if (activeOnly) (where as { active?: boolean }).active = true;
    return this.repo.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" } as never,
    });
  }

  /** Lista los elementos del negocio con paginación y búsqueda por nombre. */
  async findPaginated(
    businessId: string,
    params: PaginateParams,
    activeOnly?: boolean,
    search?: string
  ): Promise<IPaginatedResponse<T>> {
    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.active = true;
    if (search) where.name = contieneTexto(search);

    return paginate(this.repo, params, {
      where: where as FindOptionsWhere<T>,
      order: { sortOrder: "ASC", name: "ASC" } as never,
    });
  }

  /** Obtiene un elemento del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<T> {
    const encontrado = await this.repo.findOne({
      where: { id, businessId } as FindOptionsWhere<T>,
    });
    if (!encontrado) {
      throw new NotFoundException(`${this.textos.singular} no encontrada`);
    }
    return encontrado;
  }

  /** Actualiza un elemento rechazando un nombre que ya use otro. */
  async update(id: string, businessId: string, dto: Partial<T>): Promise<T> {
    const actual = await this.findById(id, businessId);

    if (dto.name && dto.name !== actual.name) {
      await this.asegurarNombreLibre(businessId, dto.name);
    }

    await this.repo.update(
      { id, businessId } as FindOptionsWhere<T>,
      dto as never
    );
    return this.findById(id, businessId);
  }

  /** Da de baja un elemento sin borrarlo, para no perder lo que lo referencia. */
  async remove(id: string, businessId: string): Promise<void> {
    await this.findById(id, businessId);
    await this.repo.update(
      { id, businessId } as FindOptionsWhere<T>,
      {
        active: false,
      } as never
    );
  }

  /** Alterna el estado activo/inactivo de un elemento. */
  async toggleActive(id: string, businessId: string): Promise<T> {
    const actual = await this.findById(id, businessId);
    await this.repo.update(
      { id, businessId } as FindOptionsWhere<T>,
      {
        active: !actual.active,
      } as never
    );
    return this.findById(id, businessId);
  }

  /** Aplica el nuevo orden a los elementos indicados en una transacción. */
  async reorder(
    businessId: string,
    items: { id: string; sortOrder: number }[]
  ): Promise<void> {
    if (items.length === 0) return;

    await this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository<T>(this.repo.target);
      for (const item of items) {
        const resultado = await repo.update(
          { id: item.id, businessId } as FindOptionsWhere<T>,
          { sortOrder: item.sortOrder } as never
        );
        if (!resultado.affected) {
          throw new NotFoundException(`${this.textos.singular} no encontrada`);
        }
      }
    });
  }

  /** Rechaza el nombre si ya lo usa otro elemento del negocio, activo o no. */
  protected async asegurarNombreLibre(
    businessId: string,
    name: string
  ): Promise<void> {
    const existente = await this.repo.findOne({
      where: { name, businessId } as FindOptionsWhere<T>,
    });
    if (!existente) return;

    throw new ConflictException(
      existente.active
        ? `${this.textos.conArticulo} "${name}" ya existe`
        : `${this.textos.conArticulo} "${name}" ya existe pero está desactivada; reactívala en lugar de crearla otra vez`
    );
  }
}
