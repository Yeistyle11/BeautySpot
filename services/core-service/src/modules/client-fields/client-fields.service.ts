import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantCrudService } from "@beautyspot/nest-common";
import {
  CampoDeFicha,
  TipoDeCampo,
} from "../../entities/campo-de-ficha.entity";

/** Campos que cada negocio añade a la ficha de sus clientes. */
@Injectable()
export class ClientFieldsService extends TenantCrudService<CampoDeFicha> {
  constructor(@InjectRepository(CampoDeFicha) repo: Repository<CampoDeFicha>) {
    super(repo, "Campo de ficha no encontrado");
  }

  /** Define un campo nuevo para el negocio. */
  async create(
    businessId: string,
    data: Partial<CampoDeFicha>
  ): Promise<CampoDeFicha> {
    this.validar(data);
    const campo = this.repo.create({ ...data, businessId });
    return this.repo.save(campo);
  }

  /** Actualiza un campo, comprobando que siga siendo coherente. */
  async update(
    id: string,
    businessId: string,
    data: Partial<CampoDeFicha>
  ): Promise<CampoDeFicha> {
    const actual = await this.findById(id, businessId);
    this.validar({ ...actual, ...data });
    return super.update(id, businessId, data);
  }

  /** Campos del negocio, ordenados como se pintan en la ficha. */
  async findByBusiness(
    businessId: string,
    soloActivos = true
  ): Promise<CampoDeFicha[]> {
    return this.repo.find({
      where: soloActivos ? { businessId, active: true } : { businessId },
      order: { orden: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * Da de baja el campo en vez de borrarlo: los clientes que ya respondieron
   * conservan su valor, y reactivarlo lo devuelve tal cual estaba.
   */
  async remove(id: string, businessId: string): Promise<void> {
    await this.findById(id, businessId);
    await this.repo.update({ id, businessId }, { active: false });
  }

  /** Un campo de opciones sin opciones no se puede rellenar. */
  private validar(data: Partial<CampoDeFicha>): void {
    if (data.tipo !== TipoDeCampo.OPCIONES) return;
    if (!data.opciones || data.opciones.length === 0) {
      throw new BadRequestException(
        "Un campo de opciones necesita al menos una"
      );
    }
  }
}
