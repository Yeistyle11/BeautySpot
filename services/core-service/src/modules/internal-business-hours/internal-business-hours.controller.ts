import { Internal } from "@beautyspot/nest-common";
import { Controller, Get, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessHours } from "../../entities/business-hours.entity";
import { SpecialDaysService } from "../business-hours/special-days.service";

/** Tramo de apertura tal y como lo consume booking. */
export interface TramoDeApertura {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

/** Apertura de una fecha concreta, ya resuelta contra los días especiales. */
export interface AperturaDelDia {
  /** Tramos que se abren ese día; vacío es "cerrado". */
  tramos: { openTime: string; closeTime: string }[];
  /** De dónde sale: el horario semanal o un día especial. */
  origen: "semanal" | "especial";
  /**
   * Si el negocio tiene horario semanal declarado. Sin él, la agenda no acota
   * por apertura, que es distinto de un día cerrado.
   */
  configurado: boolean;
  /** Lo que el negocio escribió al declarar el día especial. */
  motivo?: string;
}

/** Endpoint interno (servicio-a-servicio) con el horario de apertura del negocio. */
@Internal()
@Controller("internal/business-hours")
export class InternalBusinessHoursController {
  constructor(
    @InjectRepository(BusinessHours)
    private readonly repo: Repository<BusinessHours>,
    private readonly especiales: SpecialDaysService
  ) {}

  /** Tramos activos del negocio, ordenados por día y hora de apertura. */
  @Get()
  async delNegocio(
    @Query("businessId") businessId: string
  ): Promise<TramoDeApertura[]> {
    const tramos = await this.repo.find({
      where: { businessId, active: true },
      order: { dayOfWeek: "ASC", openTime: "ASC" },
    });

    return tramos.map((t) => ({
      dayOfWeek: t.dayOfWeek,
      openTime: t.openTime,
      closeTime: t.closeTime,
    }));
  }

  /**
   * Apertura de una fecha: el día especial que la cubra y, si no hay ninguno,
   * el horario de ese día de la semana.
   */
  @Get("dia")
  async delDia(
    @Query("businessId") businessId: string,
    @Query("date") date: string,
    @Query("branchId") branchId?: string
  ): Promise<AperturaDelDia> {
    const [especial, semana] = await Promise.all([
      this.especiales.delDia(businessId, date, branchId),
      this.delNegocio(businessId),
    ]);

    if (especial) {
      return {
        tramos:
          especial.closed || !especial.openTime || !especial.closeTime
            ? []
            : [{ openTime: especial.openTime, closeTime: especial.closeTime }],
        origen: "especial",
        configurado: true,
        motivo: especial.motivo,
      };
    }

    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();

    return {
      tramos: semana
        .filter((t) => t.dayOfWeek === dayOfWeek)
        .map((t) => ({ openTime: t.openTime, closeTime: t.closeTime })),
      origen: "semanal",
      configurado: semana.length > 0,
    };
  }
}
