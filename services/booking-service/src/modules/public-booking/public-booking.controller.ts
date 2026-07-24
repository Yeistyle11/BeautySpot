import { Controller, Post, Body } from "@nestjs/common";
import { Public } from "@beautyspot/nest-common";
import { PublicBookingService } from "./public-booking.service";
import { PublicBookingDto } from "./dto/public-booking.dto";

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
