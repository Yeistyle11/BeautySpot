import { NotFoundException } from "@nestjs/common";
import { FindOptionsWhere, Repository } from "typeorm";

/** Forma mínima de una entidad que pertenece a un negocio y admite baja lógica. */
export interface EntidadDeNegocio {
  id: string;
  businessId: string;
  active: boolean;
}

/**
 * Lectura, actualización y baja de una entidad, siempre acotadas al negocio.
 *
 * El trío estaba repetido casi palabra por palabra en una decena de servicios.
 * Lo que se gana no es ahorrar líneas: es que el `businessId` deje de depender
 * de que cada método se acuerde de ponerlo en el `where`. Olvidarlo una vez es
 * exactamente como apareció el fallo que permitía a un negocio responder las
 * reseñas de otro.
 */
export abstract class TenantCrudService<T extends EntidadDeNegocio> {
  protected constructor(
    protected readonly repo: Repository<T>,
    /** Mensaje completo del 404, porque el género cambia según la entidad. */
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

  /** Da de baja un elemento sin borrarlo, para no perder lo que lo referencia. */
  async deactivate(id: string, businessId: string): Promise<void> {
    await this.repo.update(
      { id, businessId } as FindOptionsWhere<T>,
      {
        active: false,
      } as never
    );
  }
}
