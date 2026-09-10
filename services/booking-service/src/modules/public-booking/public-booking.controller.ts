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
 * Reserva del escaparate con la sesión iniciada: liga la ficha del negocio a la
 * cuenta de quien reserva, y de ahí salen *Mis Citas* y el poder cancelar,
 * reagendar o reseñar. Va aparte porque el vínculo sale del token.
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
