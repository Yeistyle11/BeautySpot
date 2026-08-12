import { Controller, Get, Patch, Body } from "@nestjs/common";
import {
  BusinessConfigService,
  CLAVE_FACTURACION,
  CLAVE_FIDELIZACION,
  CLAVE_RESERVAS,
} from "./business-config.service";
import {
  FacturacionDto,
  FidelizacionDto,
  ReservasDto,
} from "./dto/business-config.dto";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { NIVELES_FIDELIDAD_POR_DEFECTO } from "@beautyspot/shared-constants";

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

  /** Niveles del programa de fidelidad; los de por defecto si no los ha tocado. */
  @Get("fidelizacion")
  async leerFidelizacion(@BusinessId() businessId: string) {
    const guardado = await this.service.leer(businessId, CLAVE_FIDELIZACION);
    return { niveles: guardado.niveles ?? NIVELES_FIDELIDAD_POR_DEFECTO };
  }

  @Patch("fidelizacion")
  async guardarFidelizacion(
    @BusinessId() businessId: string,
    @Body() dto: FidelizacionDto
  ) {
    return this.service.guardar(businessId, CLAVE_FIDELIZACION, { ...dto });
  }
}
