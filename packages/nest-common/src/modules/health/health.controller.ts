import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../../decorators/public.decorator";
import { HealthService, ResultadoSalud } from "./health.service";

/**
 * Expone `GET /health` con el estado de las dependencias del servicio.
 *
 * Responde 200 cuando todas están arriba y **503 cuando alguna está caída**: es
 * el código que miran las readiness probes y los healthcheck de Docker, que no
 * interpretan el cuerpo. Devolver siempre 200 con un campo "unhealthy" dejaría
 * al orquestador enviando tráfico a un servicio que no puede atenderlo.
 */
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
