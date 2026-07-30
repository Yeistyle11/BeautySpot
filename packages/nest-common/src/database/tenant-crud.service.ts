import { NotFoundException } from "@nestjs/common";
import { FindOptionsWhere, Repository } from "typeorm";

/** Forma mínima de una entidad que pertenece a un negocio y admite baja lógica. */
export interface EntidadDeNegocio {
  id: string;
  businessId: string;
  active: boolean;
}

/** Lectura, actualización y baja de una entidad, siempre acotadas al negocio. */
export abstract class TenantCrudService<T extends EntidadDeNegocio> {
  protected constructor(
    protected readonly repo: Repository<T>,
    /** Mensaje completo del 404, que cada entidad redacta a su manera. */
    private readonly mensajeNoEncontrado: string
  ) {}

  /** Obtiene un elemento del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<T> {
    const encontrado = await this.repo.findOne({
      where: { id, businessId } as FindOptionsWhere<T>,
    });
    if (!encontrado) throw new NotFoundException(this.mensajeNoEncontrado);
    return encontrado;
  }

  /** Actualiza un elemento del negocio y devuelve cómo queda. */
  async update(id: string, businessId: string, data: Partial<T>): Promise<T> {
    await this.repo.update(
      { id, businessId } as FindOptionsWhere<T>,
      data as never
    );
    return this.findById(id, businessId);
  }

  /** Da de baja un elemento del negocio sin borrarlo. */
  async deactivate(id: string, businessId: string): Promise<void> {
    await this.repo.update(
      { id, businessId } as FindOptionsWhere<T>,
      {
        active: false,
      } as never
    );
  }
}
