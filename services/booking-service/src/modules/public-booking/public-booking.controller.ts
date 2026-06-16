import { Controller, Post, Body } from "@nestjs/common";
import { Public } from "@beautyspot/nest-common";
import { PublicBookingService } from "./public-booking.service";
import { PublicBookingDto } from "./dto/public-booking.dto";

@Public()
@Controller("public")
export class PublicBookingController {
  constructor(private readonly service: PublicBookingService) {}

  @Post("appointments")
  async createPublic(@Body() dto: PublicBookingDto) {
    return this.service.createPublicAppointment(dto);
  }
}
