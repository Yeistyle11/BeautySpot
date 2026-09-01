import { ConflictException, NotFoundException } from "@nestjs/common";
import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";
import { FindOptionsWhere, Repository } from "typeorm";

/** Forma mínima de una entidad que pertenece a un negocio y admite baja lógica. */
export interface EntidadDeNegocio {
  id: string;
  businessId: string;
  active: boolean;
  updatedAt: Date;
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

  /**
   * Actualiza un elemento del negocio y devuelve cómo queda.
   *
   * Con `updatedAtEsperado` la escritura es condicional: si la fila cambió
   * desde que quien edita la cargó, se responde 409 en vez de pisar en
   * silencio lo que otra persona acaba de guardar. Sin ese argumento se
   * escribe sin más, que es lo que hacen las rutas de un solo editor.
   */
  async update(
    id: string,
    businessId: string,
    data: Partial<T>,
    updatedAtEsperado?: Date
  ): Promise<T> {
    if (!updatedAtEsperado) {
      await this.repo.update(
        { id, businessId } as FindOptionsWhere<T>,
        data as never
      );
      return this.findById(id, businessId);
    }

    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository<T>(this.repo.target);
      const donde = { id, businessId } as FindOptionsWhere<T>;

      // El bloqueo sostiene la fila entre el cotejo y la escritura: sin él, dos
      // guardados con la misma marca de partida pasarían los dos el cotejo.
      const actual = await repo.findOne({
        where: donde,
        lock: { mode: "pessimistic_write" },
      });
      if (!actual) throw new NotFoundException(this.mensajeNoEncontrado);

      if (actual.updatedAt.getTime() !== updatedAtEsperado.getTime()) {
        throw new ConflictException({
          error: {
            code: CODIGO_EDICION_SIMULTANEA,
            message:
              "Otra persona guardó cambios mientras editabas. Recarga para ver cómo ha quedado.",
          },
        });
      }

      await repo.update(donde, data as never);
      const guardado = await repo.findOne({ where: donde });
      if (!guardado) throw new NotFoundException(this.mensajeNoEncontrado);
      return guardado;
    });
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
