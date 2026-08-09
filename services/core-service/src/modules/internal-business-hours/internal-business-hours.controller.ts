import { Controller, Get, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessHours } from "../../entities/business-hours.entity";

/** Tramo de apertura tal y como lo consume booking. */
export interface TramoDeApertura {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

/** Endpoint interno (servicio-a-servicio) con el horario de apertura del negocio. */
@Controller("internal/business-hours")
export class InternalBusinessHoursController {
  constructor(
    @InjectRepository(BusinessHours)
    private readonly repo: Repository<BusinessHours>
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
}
