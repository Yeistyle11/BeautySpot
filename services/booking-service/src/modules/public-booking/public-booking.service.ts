import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { AppointmentsService } from "../appointments/appointments.service";
import {
  calculateEndTime,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";

/**
 * Permite reservar citas desde el marketplace sin autenticación, resolviendo al
 * cliente invitado contra el core-service y validando la disponibilidad.
 */
@Injectable()
export class PublicBookingService {
  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Availability)
    private readonly availRepo: Repository<Availability>,
    @InjectRepository(BlockedSlot)
    private readonly blockRepo: Repository<BlockedSlot>,
    private readonly http: InternalHttpClient,
    private readonly appointments: AppointmentsService
  ) {}

  /**
   * Crea una cita a partir de los datos de un invitado: resuelve o crea el
   * cliente, elige profesional si no vino indicado y registra la cita.
   *
   * El alta se delega en AppointmentsService, que es donde vive la transacción
   * SERIALIZABLE con la comprobación final de conflicto. Este camino guardaba
   * por su cuenta con un save suelto, así que dos reservas simultáneas sobre la
   * misma franja se creaban las dos y la cita no emitía su evento.
   */
  async createPublicAppointment(data: {
    businessId: string;
    professionalId?: string;
    serviceIds: string[];
    date: string;
    startTime: string;
    notes?: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
  }) {
    // 1. Resolver o crear el cliente invitado vía el endpoint interno del core-service.
    const clientId = await this.findOrCreateGuestClient(
      data.businessId,
      data.guestName,
      data.guestEmail,
      data.guestPhone
    );

    // 2. Elegir profesional si el invitado no pidió uno. Para eso hace falta
    //    la hora de fin, y la duración solo la sabe el catálogo. Se resuelve
    //    con la duración base (sin profesional, que aún no existe) y luego el
    //    alta la vuelve a resolver ya con el elegido, por si ese profesional
    //    tiene una duración propia. Es la única vía con dos consultas y solo
    //    ocurre en "cualquiera disponible".
    const professionalId =
      data.professionalId ??
      (await this.elegirProfesional(data.businessId, data.serviceIds, data));

    const saved = await this.appointments.create(data.businessId, {
      professionalId,
      clientId,
      serviceIds: data.serviceIds,
      date: data.date,
      startTime: data.startTime,
      notes: data.notes,
    });

    return {
      id: saved.id,
      date: saved.date,
      startTime: saved.startTime,
      endTime: saved.endTime,
      status: saved.status,
      totalAmount: saved.totalAmount,
      services: saved.appointmentServices.map((s) => s.serviceName),
    };
  }

  /** Busca el primer profesional libre usando la duración base del catálogo. */
  private async elegirProfesional(
    businessId: string,
    serviceIds: string[],
    horario: { date: string; startTime: string }
  ): Promise<string> {
    const servicios = await this.http.enviar<{ duration: number }[]>(
      "core",
      "/internal/services/resolve",
      { businessId, ids: serviceIds }
    );

    if (!Array.isArray(servicios) || servicios.length === 0) {
      throw new BadRequestException(
        "No se pudieron resolver los servicios de la cita"
      );
    }

    const totalDuration = servicios.reduce((sum, s) => sum + s.duration, 0);
    const endTime = calculateEndTime(horario.startTime, totalDuration);
    const dayOfWeek = new Date(horario.date + "T12:00:00").getDay();

    return this.primerProfesionalLibre(
      businessId,
      horario.date,
      horario.startTime,
      endTime,
      dayOfWeek
    );
  }

  /**
   * Pide al core-service el cliente que coincida o uno nuevo; falla si el
   * servicio no responde.
   *
   * No pasa `userId`: esta ruta no tiene token, así que no hay ninguna
   * identidad que se pueda dar por buena para atar la ficha a una cuenta.
   */
  private async findOrCreateGuestClient(
    businessId: string,
    name: string,
    email?: string,
    phone?: string
  ): Promise<string> {
    const client = await this.http.enviar<{ id?: unknown }>(
      "core",
      "/internal/clients/find-or-create",
      { businessId, name, email, phone }
    );

    if (!client || typeof client.id !== "string" || client.id.length === 0) {
      throw new InternalServerErrorException(
        "El core-service no retorno un clientId valido"
      );
    }

    return client.id;
  }

  /**
   * Primer profesional con horario activo ese dia y la franja libre, en el
   * orden en que los devuelve la tabla de horarios.
   */
  private async primerProfesionalLibre(
    businessId: string,
    date: string,
    startTime: string,
    endTime: string,
    dayOfWeek: number
  ): Promise<string> {
    const horarios = await this.availRepo.find({
      where: { businessId, dayOfWeek, active: true },
    });

    const candidatos = [...new Set(horarios.map((h) => h.professionalId))];
    if (candidatos.length === 0) {
      throw new BadRequestException(
        "Ningun profesional tiene libre ese horario. Elige otra hora."
      );
    }

    // Bloqueos y citas de todos los candidatos en dos consultas, sea cual sea
    // su número.
    const [bloqueos, citas] = await Promise.all([
      this.blockRepo.find({
        where: { businessId, professionalId: In(candidatos), date },
      }),
      this.apptRepo.find({
        where: {
          businessId,
          professionalId: In(candidatos),
          date,
          status: In([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
          ]),
        },
      }),
    ]);

    const horarioPorProfesional = new Map<string, Availability>();
    for (const horario of horarios) {
      if (!horarioPorProfesional.has(horario.professionalId)) {
        horarioPorProfesional.set(horario.professionalId, horario);
      }
    }

    for (const professionalId of candidatos) {
      const horario = horarioPorProfesional.get(professionalId);
      if (!horario) continue;
      if (
        timeToMinutes(startTime) < timeToMinutes(horario.startTime) ||
        timeToMinutes(endTime) > timeToMinutes(horario.endTime)
      ) {
        continue;
      }

      const bloqueado = bloqueos.some(
        (b) =>
          b.professionalId === professionalId &&
          timesOverlap(startTime, endTime, b.startTime, b.endTime)
      );
      if (bloqueado) continue;

      const ocupado = citas.some(
        (a) =>
          a.professionalId === professionalId &&
          timesOverlap(startTime, endTime, a.startTime, a.endTime)
      );
      if (!ocupado) return professionalId;
    }

    throw new BadRequestException(
      "Ningun profesional tiene libre ese horario. Elige otra hora."
    );
  }
}
