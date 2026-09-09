import { Controller, Post, Body } from "@nestjs/common";
import {
  Public,
  Roles,
  CurrentUser,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { PublicBookingService } from "./public-booking.service";
import { PublicBookingDto } from "./dto/public-booking.dto";
import { MiReservaDto } from "./dto/mi-reserva.dto";

/** Endpoint público (sin token) para que un invitado reserve una cita desde el marketplace. */
@Public()
@Controller("public")
export class PublicBookingController {
  constructor(private readonly service: PublicBookingService) {}

  /** Crea una cita a partir de los datos de contacto del invitado. */
  @Post("appointments")
  async createPublic(@Body() dto: PublicBookingDto) {
    return this.service.createPublicAppointment(dto);
  }
}

/**
 * Reserva del escaparate con la sesión iniciada.
 *
 * Es la que liga la ficha del negocio a la cuenta de quien reserva, y sin ella
 * el área del cliente queda vacía: reservar con cuenta daba exactamente lo
 * mismo que reservar como invitado, así que *Mis Citas* salía a cero y ningún
 * cliente podía cancelar, reagendar ni reseñar nada.
 *
 * Va aparte de la ruta pública porque el vínculo tiene que salir del token: la
 * pública no acepta un `userId` en el cuerpo a propósito, y aceptarlo dejaría
 * reservar a nombre de otro.
 */
@Controller("appointments")
export class MiReservaController {
  constructor(private readonly service: PublicBookingService) {}

  /** Crea una cita a nombre del cliente autenticado. */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Post("mine")
  async createMine(
    @Body() dto: MiReservaDto,
    @CurrentUser("userId") userId: string
  ) {
    return this.service.createPublicAppointment(dto, userId);
  }
}
