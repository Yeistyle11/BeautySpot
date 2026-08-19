import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import {
  cruzaMedianoche,
  esHoraDeCierreValida,
  esHoraValida,
  MAXIMO_CIERRE_DE_MADRUGADA,
  timeToMinutes,
} from "@beautyspot/shared-utils";
import { BusinessSpecialDay } from "../../entities/business-special-day.entity";
import { CreateSpecialDayDto } from "./dto/special-day.dto";

/** Tramo de apertura con el formato que consumen la agenda y el marketplace. */
export interface TramoDelDia {
  openTime: string;
  closeTime: string;
}

/**
 * Días especiales del negocio: festivos, vacaciones y jornadas con horario
 * propio, que pesan más que el horario de la semana.
 */
@Injectable()
export class SpecialDaysService {
  constructor(
    @InjectRepository(BusinessSpecialDay)
    private readonly repo: Repository<BusinessSpecialDay>
  ) {}

  /** Días especiales del negocio, del más próximo al más lejano. */
  async findByBusiness(businessId: string): Promise<BusinessSpecialDay[]> {
    return this.repo.find({
      where: { businessId },
      order: { startDate: "ASC" },
    });
  }

  /** Declara un día especial, comprobando el rango, las horas y los solapes. */
  async create(
    businessId: string,
    dto: CreateSpecialDayDto
  ): Promise<BusinessSpecialDay> {
    this.validar(dto);
    await this.exigirQueNoSeSolape(businessId, dto);

    return this.repo.save(
      this.repo.create({
        businessId,
        branchId: dto.branchId ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        closed: dto.closed ?? true,
        openTime: dto.closed === false ? (dto.openTime ?? null) : null,
        closeTime: dto.closed === false ? (dto.closeTime ?? null) : null,
        motivo: dto.motivo.trim(),
      })
    );
  }

  /** Retira un día especial del negocio; lanza 404 si no existe. */
  async remove(id: string, businessId: string): Promise<void> {
    const borrado = await this.repo.delete({ id, businessId });
    if (!borrado.affected) {
      throw new NotFoundException("Ese día especial no existe");
    }
  }

  /**
   * El día especial que cubre esa fecha, o `null` si no hay ninguno; el de una
   * sede gana al declarado para todo el negocio.
   */
  async delDia(
    businessId: string,
    fecha: string,
    branchId?: string
  ): Promise<BusinessSpecialDay | null> {
    const candidatos = await this.repo.find({
      where: {
        businessId,
        startDate: LessThanOrEqual(fecha),
        endDate: MoreThanOrEqual(fecha),
      },
    });

    return (
      candidatos.find((d) => branchId && d.branchId === branchId) ??
      candidatos.find((d) => !d.branchId) ??
      null
    );
  }

  /** Comprueba el rango y, cuando el día abre, sus horas. */
  private validar(dto: CreateSpecialDayDto): void {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        "El día de fin no puede ser anterior al de inicio"
      );
    }

    if (dto.closed !== false) return;

    const { openTime, closeTime } = dto;
    if (!openTime || !closeTime) {
      throw new BadRequestException(
        "Un día que abre necesita hora de apertura y de cierre"
      );
    }
    if (!esHoraValida(openTime)) {
      throw new BadRequestException(
        `Hora de apertura invalida: ${openTime}. Se espera HH:MM, de 00:00 a 23:59`
      );
    }
    if (!esHoraDeCierreValida(closeTime)) {
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
      cruzaMedianoche(openTime, closeTime) &&
      timeToMinutes(closeTime) > timeToMinutes(MAXIMO_CIERRE_DE_MADRUGADA)
    ) {
      throw new BadRequestException(
        `El cierre de madrugada ${closeTime} no puede pasar de las ${MAXIMO_CIERRE_DE_MADRUGADA}`
      );
    }
  }

  /** Rechaza el rango que pisa a otro ya declarado para el mismo alcance. */
  private async exigirQueNoSeSolape(
    businessId: string,
    dto: CreateSpecialDayDto
  ): Promise<void> {
    const solapados = await this.repo.find({
      where: {
        businessId,
        startDate: LessThanOrEqual(dto.endDate),
        endDate: MoreThanOrEqual(dto.startDate),
      },
    });

    const mismoAlcance = solapados.filter(
      (d) => (d.branchId ?? null) === (dto.branchId ?? null)
    );
    if (mismoAlcance.length > 0) {
      const otro = mismoAlcance[0];
      throw new BadRequestException(
        `Esas fechas ya están declaradas como "${otro.motivo}" (${otro.startDate} a ${otro.endDate})`
      );
    }
  }
}
