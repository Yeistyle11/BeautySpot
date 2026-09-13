import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { AppointmentsService } from "../appointments/appointments.service";
import { AvailabilityQueryService } from "../appointments/availability-query.service";
import { calculateEndTime, duracionDeCliente } from "@beautyspot/shared-utils";

/** Servicio tal y como lo devuelve el catálogo, con su reparto de agenda. */
interface LineaResuelta {
  duration: number;
  procesadoDesde: number | null;
  procesadoMinutos: number | null;
  bufferDespues: number;
}

/**
 * Permite reservar desde el marketplace, resolviendo al cliente contra el
 * core-service y validando la disponibilidad. Sirve al invitado y al cliente
 * con sesión; el `userId` lo pone el controlador desde el token.
 */
@Injectable()
export class PublicBookingService {
  constructor(
    private readonly http: InternalHttpClient,
    private readonly appointments: AppointmentsService,
    private readonly disponibilidad: AvailabilityQueryService
  ) {}

  /**
   * Crea una cita del escaparate: resuelve o crea el cliente, elige profesional
   * si no vino indicado y delega el alta. `userId` y `userEmail` llegan solo
   * con sesión y siempre desde el token; con ellos la ficha queda ligada a esa
   * cuenta.
   */
  async createPublicAppointment(
    data: {
      businessId: string;
      professionalId?: string;
      serviceIds: string[];
      date: string;
      startTime: string;
      notes?: string;
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
    },
    userId?: string,
    userEmail?: string
  ) {
    // 1. Resolver o crear el cliente vía el endpoint interno del core-service.
    const clientId = await this.findOrCreateGuestClient(
      data.businessId,
      data.guestName,
      data.guestEmail,
      data.guestPhone,
      userId,
      userEmail
    );

    // 2. Elegir profesional si el invitado no pidio uno, con la duracion base
    //    del catalogo; el alta la vuelve a resolver con el ya elegido.
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

  /**
   * Busca el primer profesional libre usando la duración base del catálogo. La
   * disponibilidad la decide el motor de la agenda, que es quien conoce la
   * apertura del negocio, las jornadas partidas y lo que arrastra la madrugada.
   */
  private async elegirProfesional(
    businessId: string,
    serviceIds: string[],
    horario: { date: string; startTime: string }
  ): Promise<string> {
    const servicios = await this.http.enviar<LineaResuelta[]>(
      "core",
      "/internal/services/resolve",
      { businessId, ids: serviceIds }
    );

    if (!Array.isArray(servicios) || servicios.length === 0) {
      throw new BadRequestException(
        "No se pudieron resolver los servicios de la cita"
      );
    }

    const lineas = servicios.map((s, orden) => ({ ...s, orden }));
    const professionalId = await this.disponibilidad.primerProfesionalLibre(
      businessId,
      horario.date,
      horario.startTime,
      calculateEndTime(horario.startTime, duracionDeCliente(lineas)),
      lineas
    );

    if (!professionalId) {
      throw new BadRequestException(
        "Ningun profesional tiene libre ese horario. Elige otra hora."
      );
    }

    return professionalId;
  }

  /**
   * Pide al core-service el cliente que coincida o uno nuevo; falla si no
   * responde. `userId` y `userEmail` viajan solo en la reserva con sesión y
   * salen del token: el core identifica por ellos, mientras que `email` y
   * `phone` son lo que la persona escribió y solo dicen cómo avisarle.
   */
  private async findOrCreateGuestClient(
    businessId: string,
    name: string,
    email?: string,
    phone?: string,
    userId?: string,
    userEmail?: string
  ): Promise<string> {
    const client = await this.http.enviar<{ id?: unknown }>(
      "core",
      "/internal/clients/find-or-create",
      {
        businessId,
        name,
        email,
        phone,
        ...(userId ? { userId } : {}),
        ...(userId && userEmail ? { userEmail } : {}),
      }
    );

    if (!client || typeof client.id !== "string" || client.id.length === 0) {
      throw new InternalServerErrorException(
        "El core-service no retorno un clientId valido"
      );
    }

    return client.id;
  }
}
