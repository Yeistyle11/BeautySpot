import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  cruzaMedianoche,
  esHoraDeCierreValida,
  esHoraValida,
  finExtendido,
  MAXIMO_CIERRE_DE_MADRUGADA,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";
import { BusinessHours } from "../../entities/business-hours.entity";

/** Gestiona el horario semanal de apertura de un negocio (opcionalmente por sede). */
@Injectable()
export class BusinessHoursService {
  constructor(
    @InjectRepository(BusinessHours)
    private readonly repo: Repository<BusinessHours>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  /** Devuelve los tramos horarios del negocio (o de una sede), ordenados por día y hora. */
  async findByBusiness(
    businessId: string,
    branchId?: string
  ): Promise<BusinessHours[]> {
    const where: Record<string, unknown> = { businessId };
    if (branchId) where.branchId = branchId;
    return this.repo.find({
      where,
      order: { dayOfWeek: "ASC", openTime: "ASC" },
    });
  }

  /** Reemplaza el horario del negocio por el conjunto recibido, en transacción. */
  async batchUpsert(
    businessId: string,
    items: Partial<BusinessHours>[]
  ): Promise<BusinessHours[]> {
    this.validar(items);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BusinessHours);
      await repo.delete({ businessId });

      const hours = items.map((item) =>
        repo.create({
          businessId,
          branchId: item.branchId || undefined,
          dayOfWeek: item.dayOfWeek!,
          openTime: item.openTime!,
          closeTime: item.closeTime!,
          active: item.active !== undefined ? item.active : true,
        })
      );

      return repo.save(hours);
    });
  }

  /** Actualiza un único tramo horario del negocio. */
  async updateOne(
    id: string,
    businessId: string,
    data: Partial<BusinessHours>
  ): Promise<BusinessHours> {
    await this.repo.update(
      { id, businessId },
      data as Parameters<typeof this.repo.update>[1]
    );
    const hour = await this.repo.findOne({ where: { id, businessId } });
    if (!hour) throw new Error("Horario no encontrado");
    return hour;
  }

  /**
   * Valida formato `HH:MM`, los cierres de madrugada y los solapes por dia y
   * sede.
   */
  private validar(items: Partial<BusinessHours>[]): void {
    for (const item of items) {
      const { openTime, closeTime } = item;
      if (!esHoraValida(openTime ?? "")) {
        throw new BadRequestException(
          `Hora de apertura invalida: ${openTime}. Se espera HH:MM, de 00:00 a 23:59`
        );
      }
      if (!esHoraDeCierreValida(closeTime ?? "")) {
        throw new BadRequestException(
          `Hora de cierre invalida: ${closeTime}. Se espera HH:MM, de 00:00 a 24:00`
        );
      }
      if (openTime === closeTime) {
        throw new BadRequestException(
          `El tramo ${openTime}-${closeTime} no dura nada. El dia completo se pone de 00:00 a 24:00`
        );
      }
      if (
        cruzaMedianoche(openTime!, closeTime!) &&
        timeToMinutes(closeTime!) > timeToMinutes(MAXIMO_CIERRE_DE_MADRUGADA)
      ) {
        throw new BadRequestException(
          `El cierre de madrugada ${closeTime} no puede pasar de las ${MAXIMO_CIERRE_DE_MADRUGADA}`
        );
      }
    }

    // Los tramos de sedes distintas son independientes entre sí.
    const porDia = new Map<string, Partial<BusinessHours>[]>();
    for (const item of items) {
      const clave = `${item.branchId ?? ""}:${item.dayOfWeek}`;
      const delDia = porDia.get(clave) ?? [];
      // Los solapes se miran en la escala del cálculo: un tramo de 20:00 a
      // 02:00 comparado con la hora de reloj se leería al revés.
      if (
        delDia.some((otro) =>
          timesOverlap(
            item.openTime!,
            finExtendido(item.openTime!, item.closeTime!),
            otro.openTime!,
            finExtendido(otro.openTime!, otro.closeTime!)
          )
        )
      ) {
        throw new BadRequestException(
          `Hay tramos que se solapan el dia ${item.dayOfWeek}`
        );
      }
      delDia.push(item);
      porDia.set(clave, delDia);
    }
  }
}
