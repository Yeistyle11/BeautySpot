import { randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository, MoreThanOrEqual } from "typeorm";
import {
  esFechaPasadaEn,
  esHoraValida,
  fechaDeHoyEn,
  finExtendido,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";
import {
  AppointmentStatus,
  RepeticionDeBloqueo,
} from "@beautyspot/shared-types";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { Appointment } from "../../entities/appointment.entity";

/** Estados de cita que impiden bloquear la franja por encima. */
const ESTADOS_VIVOS = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

/** Tope de ocurrencias de una serie: un año de bloqueos diarios. */
const MAXIMO_DE_LA_SERIE = 366;

/** El día en `YYYY-MM-DD`, que es como se guarda la fecha del bloqueo. */
function diaComoFecha(dia: Date): string {
  return dia.toISOString().slice(0, 10);
}

/** Gestiona los bloqueos puntuales de agenda de un profesional (vacaciones, descansos). */
@Injectable()
export class BlockedSlotsService {
  constructor(
    @InjectRepository(BlockedSlot)
    private readonly repo: Repository<BlockedSlot>,
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    private readonly zonas: ZonaDelNegocioService
  ) {}

  /** Lista los bloqueos de un profesional (por defecto solo los futuros). */
  async findByProfessional(
    businessId: string,
    professionalId: string,
    futureOnly = true
  ): Promise<BlockedSlot[]> {
    const where: Record<string, unknown> = { businessId, professionalId };
    if (futureOnly) {
      const zona = await this.zonas.de(businessId);
      where.date = MoreThanOrEqual(fechaDeHoyEn(zona));
    }
    return this.repo.find({ where, order: { date: "ASC", startTime: "ASC" } });
  }

  /** Bloqueos de todo el equipo un día concreto, para pintarlos en la agenda. */
  async findByDate(businessId: string, date: string): Promise<BlockedSlot[]> {
    return this.repo.find({
      where: { businessId, date },
      order: { startTime: "ASC" },
    });
  }

  /**
   * Crea el bloqueo de agenda; con `repeticion`, uno por cada dia que cubra.
   * Valida todas las ocurrencias antes de guardar ninguna.
   */
  async create(
    businessId: string,
    professionalId: string,
    data: {
      date: string;
      startTime: string;
      endTime: string;
      reason?: string;
      repeticion?: RepeticionDeBloqueo;
      repetirHasta?: string;
    }
  ): Promise<BlockedSlot[]> {
    const { repeticion, repetirHasta, ...bloqueo } = data;
    await this.validar(businessId, bloqueo);
    const fechas = this.fechasDeLaSerie(bloqueo.date, repeticion, repetirHasta);

    const conflictos: string[] = [];
    for (const date of fechas) {
      const choca = await this.citasQueChocan(businessId, professionalId, {
        ...bloqueo,
        date,
      });
      if (choca) conflictos.push(date);
    }
    if (conflictos.length > 0) {
      throw new BadRequestException(
        `Hay citas en ${conflictos.join(", ")}. Cancelalas o reasignalas antes de bloquear esos dias.`
      );
    }

    // Solo las series llevan identificador: un bloqueo suelto no forma parte de
    // nada y marcarlo invitaría a borrar de más.
    const serieId = fechas.length > 1 ? randomUUID() : null;
    const slots = fechas.map((date) =>
      this.repo.create({
        ...bloqueo,
        date,
        businessId,
        professionalId,
        serieId,
      })
    );
    return this.repo.save(slots);
  }

  /** Elimina un bloqueo del negocio; lanza 404 si no existe. */
  async remove(id: string, businessId: string): Promise<void> {
    const result = await this.repo.delete({ id, businessId });
    if (!result.affected) throw new NotFoundException("Bloqueo no encontrado");
  }

  /**
   * Elimina la serie entera a la que pertenece el bloqueo, incluidos los días
   * ya pasados: la serie es una sola decisión y se deshace de una vez.
   */
  async removeSerie(id: string, businessId: string): Promise<number> {
    const slot = await this.repo.findOne({ where: { id, businessId } });
    if (!slot) throw new NotFoundException("Bloqueo no encontrado");

    if (!slot.serieId) {
      await this.repo.delete({ id, businessId });
      return 1;
    }

    const result = await this.repo.delete({
      businessId,
      serieId: slot.serieId,
    });
    return result.affected ?? 0;
  }

  /**
   * Los dias que cubre la serie, del primero a `repetirHasta` incluido, con un
   * tope de ocurrencias.
   */
  private fechasDeLaSerie(
    desde: string,
    repeticion?: RepeticionDeBloqueo,
    hasta?: string
  ): string[] {
    if (!repeticion) return [desde];
    if (!hasta) {
      throw new BadRequestException(
        "Un bloqueo que se repite necesita hasta cuando"
      );
    }
    if (hasta < desde) {
      throw new BadRequestException("La repeticion termina antes de empezar");
    }

    const salto = repeticion === RepeticionDeBloqueo.SEMANAL ? 7 : 1;
    const fechas: string[] = [];
    for (
      let dia = new Date(`${desde}T00:00:00Z`);
      diaComoFecha(dia) <= hasta;
      dia = new Date(dia.getTime() + salto * 86400000)
    ) {
      fechas.push(diaComoFecha(dia));
      if (fechas.length > MAXIMO_DE_LA_SERIE) {
        throw new BadRequestException(
          `Una serie no puede pasar de ${MAXIMO_DE_LA_SERIE} bloqueos`
        );
      }
    }
    return fechas;
  }

  /**
   * Comprueba el formato y el orden de las horas y que el primer dia no haya
   * pasado.
   */
  private async validar(
    businessId: string,
    data: { date: string; startTime: string; endTime: string }
  ): Promise<void> {
    if (!esHoraValida(data.startTime) || !esHoraValida(data.endTime)) {
      throw new BadRequestException(
        `Horario invalido: ${data.startTime}-${data.endTime}. Se espera HH:MM`
      );
    }
    if (timeToMinutes(data.startTime) >= timeToMinutes(data.endTime)) {
      throw new BadRequestException("El bloqueo termina antes de empezar");
    }

    const zona = await this.zonas.de(businessId);
    if (esFechaPasadaEn(zona, data.date)) {
      throw new BadRequestException("No se puede bloquear un dia que ya paso");
    }
  }

  /** Si ese día hay alguna cita viva bajo la franja que se quiere bloquear. */
  private async citasQueChocan(
    businessId: string,
    professionalId: string,
    data: { date: string; startTime: string; endTime: string }
  ): Promise<boolean> {
    const citas = await this.apptRepo.find({
      where: {
        businessId,
        professionalId,
        date: data.date,
        status: In(ESTADOS_VIVOS),
      },
    });
    // Compara contra la envolvente de la cita, limpieza incluida, y en escala
    // extendida: la de anoche va de 23:30 a "24:30".
    return citas.some((c) =>
      timesOverlap(
        data.startTime,
        data.endTime,
        c.startTime,
        finExtendido(c.startTime, c.ocupadoHasta ?? c.endTime)
      )
    );
  }
}
