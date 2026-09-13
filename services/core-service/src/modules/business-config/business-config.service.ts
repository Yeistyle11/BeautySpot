import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { v4 as uuidv4 } from "uuid";
import { BusinessConfig } from "../../entities/business-config.entity";

/** Clave de los datos fiscales dentro de `business_config`. */
export const CLAVE_FACTURACION = "facturacion";
/** Clave de las reglas de reserva dentro de `business_config`. */
export const CLAVE_RESERVAS = "reservas";
/** Clave del programa de fidelidad dentro de `business_config`. */
export const CLAVE_FIDELIZACION = "fidelizacion";

/** Ajustes del negocio guardados por clave, sin columnas propias. */
@Injectable()
export class BusinessConfigService {
  constructor(
    @InjectRepository(BusinessConfig)
    private readonly repo: Repository<BusinessConfig>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService
  ) {}

  /** Valor de una clave, o un objeto vacío si el negocio no la ha tocado. */
  async leer(
    businessId: string,
    key: string
  ): Promise<Record<string, unknown>> {
    const fila = await this.repo.findOne({ where: { businessId, key } });
    return fila?.value ?? {};
  }

  /** Mezcla los cambios con lo guardado y devuelve cómo queda la clave. */
  async guardar(
    businessId: string,
    key: string,
    cambios: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const actual = await this.leer(businessId, key);
    const value = { ...actual, ...cambios };

    await this.dataSource.transaction(async (manager) => {
      // El id lo pone la aplicacion: la columna no tiene DEFAULT. Al chocar solo
      // se pisan el valor y la marca de tiempo.
      await manager
        .createQueryBuilder()
        .insert()
        .into(BusinessConfig)
        .values({
          id: uuidv4(),
          businessId,
          key,
          value: value as QueryDeepPartialEntity<Record<string, unknown>>,
          updatedAt: new Date(),
        })
        .orUpdate(["value", "updated_at"], ["business_id", "key"])
        .execute();

      // De aquí sale la política de reserva que booking cachea: sin el aviso,
      // cambiarla tardaba en llegar lo que tardara en caducar.
      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_BUSINESS_CONFIG_UPDATED,
        aggregateType: "business",
        aggregateId: businessId,
        payload: { businessId },
      });
    });

    return value;
  }
}
