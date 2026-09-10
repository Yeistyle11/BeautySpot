import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../../decorators/public.decorator";
import { HealthService, ResultadoSalud } from "./health.service";

/** GET /health: 200 si todas las dependencias responden, 503 si alguna falla. */
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(
    @Res({ passthrough: true }) res: Response
  ): Promise<ResultadoSalud> {
    const resultado = await this.healthService.check();

    res.status(
      resultado.status === "healthy"
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE
    );

    return resultado;
  }
}
