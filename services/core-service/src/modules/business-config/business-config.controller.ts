import { Controller, Get, Patch, Body } from "@nestjs/common";
import { BusinessConfigService } from "./business-config.service";
import { FacturacionDto, ReservasDto } from "./dto/business-config.dto";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Clave de los datos fiscales dentro de `business_config`. */
const CLAVE_FACTURACION = "facturacion";
/** Clave de las reglas de reserva dentro de `business_config`. */
const CLAVE_RESERVAS = "reservas";

/** Ajustes del negocio que no tienen columnas propias. */
@Controller("business-config")
@Roles(Role.OWNER, Role.ADMIN)
export class BusinessConfigController {
  constructor(private readonly service: BusinessConfigService) {}

  /** Datos fiscales con los que se emiten las facturas. */
  @Get("facturacion")
  async leerFacturacion(@BusinessId() businessId: string) {
    return this.service.leer(businessId, CLAVE_FACTURACION);
  }

  @Patch("facturacion")
  async guardarFacturacion(
    @BusinessId() businessId: string,
    @Body() dto: FacturacionDto
  ) {
    return this.service.guardar(businessId, CLAVE_FACTURACION, { ...dto });
  }

  /** Reglas de reserva y cancelación. */
  @Get("reservas")
  async leerReservas(@BusinessId() businessId: string) {
    return this.service.leer(businessId, CLAVE_RESERVAS);
  }

  @Patch("reservas")
  async guardarReservas(
    @BusinessId() businessId: string,
    @Body() dto: ReservasDto
  ) {
    return this.service.guardar(businessId, CLAVE_RESERVAS, { ...dto });
  }
}
