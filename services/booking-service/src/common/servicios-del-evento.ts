import { ServicioDeLaCita } from "@beautyspot/event-types";
import { AppointmentServiceEntity } from "../entities/appointment-service.entity";

/**
 * Los servicios de la cita tal y como viajan en el evento, con el nombre y el
 * precio congelados al reservarla.
 */
export function serviciosDelEvento(
  servicios?: AppointmentServiceEntity[]
): ServicioDeLaCita[] {
  // Tolera que la relación no se haya cargado: el campo es opcional en el
  // evento, y un correo con el nombre genérico vale más que un evento perdido.
  return (servicios ?? []).map((s) => ({
    serviceId: s.serviceId,
    name: s.serviceName,
    price: Number(s.price),
    duration: s.duration,
  }));
}
