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

  /**
   * Valida formato `HH:MM`, las horas de salida de madrugada y los solapes
   * dentro de cada dia.
   */
  private validar(slots: TramoSemanal[]): void {
    for (const slot of slots) {
      if (!esHoraValida(slot.startTime)) {
        throw new BadRequestException(
          `Hora de entrada invalida: ${slot.startTime}. Se espera HH:MM, de 00:00 a 23:59`
        );
      }
      if (!esHoraDeCierreValida(slot.endTime)) {
        throw new BadRequestException(
          `Hora de salida invalida: ${slot.endTime}. Se espera HH:MM, de 00:00 a 24:00`
        );
      }
      if (slot.startTime === slot.endTime) {
        throw new BadRequestException(
          `El tramo ${slot.startTime}-${slot.endTime} no dura nada. La jornada completa se pone de 00:00 a 24:00`
        );
      }
      if (
        cruzaMedianoche(slot.startTime, slot.endTime) &&
        timeToMinutes(slot.endTime) > timeToMinutes(MAXIMO_CIERRE_DE_MADRUGADA)
      ) {
        throw new BadRequestException(
          `La salida de madrugada ${slot.endTime} no puede pasar de las ${MAXIMO_CIERRE_DE_MADRUGADA}`
        );
      }
    }

    const porDia = new Map<number, TramoSemanal[]>();
    for (const slot of slots) {
      const delDia = porDia.get(slot.dayOfWeek) ?? [];
      // Los solapes se miran en la escala del cálculo: un tramo de 20:00 a
      // 02:00 comparado con la hora de reloj se leería al revés.
      if (
        delDia.some((otro) =>
          timesOverlap(
            slot.startTime,
            finExtendido(slot.startTime, slot.endTime),
            otro.startTime,
            finExtendido(otro.startTime, otro.endTime)
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
