import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  esHoraValida,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";
import { Availability } from "../../entities/availability.entity";

/** Franja semanal tal y como llega desde el formulario. */
interface TramoSemanal {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/** Gestiona la disponibilidad horaria semanal de cada profesional. */
@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Availability)
    private readonly repo: Repository<Availability>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  /**
   * Devuelve las franjas activas de un profesional, ordenadas por día y hora.
   * Un día puede traer varias.
   */
  async findByProfessional(
    businessId: string,
    professionalId: string
  ): Promise<Availability[]> {
    return this.repo.find({
      where: { businessId, professionalId, active: true },
      order: { dayOfWeek: "ASC", startTime: "ASC" },
    });
  }

  /** Reemplaza toda la disponibilidad semanal del profesional, en transacción. */
  async replaceWeekly(
    businessId: string,
    professionalId: string,
    slots: TramoSemanal[]
  ): Promise<Availability[]> {
    this.validar(slots);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Availability);
      await repo.delete({ businessId, professionalId });

      const entities = slots.map((s) =>
        repo.create({ ...s, businessId, professionalId })
      );
      return repo.save(entities);
    });
  }

  /** Valida formato `HH:MM`, orden de las horas y solapes dentro de cada día. */
  private validar(slots: TramoSemanal[]): void {
    for (const slot of slots) {
      if (!esHoraValida(slot.startTime) || !esHoraValida(slot.endTime)) {
        throw new BadRequestException(
          `Horario invalido: ${slot.startTime}-${slot.endTime}. Se espera HH:MM`
        );
      }
      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        throw new BadRequestException(
          `El tramo ${slot.startTime}-${slot.endTime} termina antes de empezar`
        );
      }
    }

    const porDia = new Map<number, TramoSemanal[]>();
    for (const slot of slots) {
      const delDia = porDia.get(slot.dayOfWeek) ?? [];
      if (
        delDia.some((otro) =>
          timesOverlap(
            slot.startTime,
            slot.endTime,
            otro.startTime,
            otro.endTime
          )
        )
      ) {
        throw new BadRequestException(
          `Hay tramos que se solapan el dia ${slot.dayOfWeek}`
        );
      }
      delDia.push(slot);
      porDia.set(slot.dayOfWeek, delDia);
    }
  }
}
