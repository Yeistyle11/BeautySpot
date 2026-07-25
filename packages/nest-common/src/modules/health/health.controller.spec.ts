import { HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { HealthController } from "./health.controller";
import { HealthService, ResultadoSalud } from "./health.service";

const respuesta = () => ({ status: jest.fn() }) as unknown as Response;

const servicio = (resultado: ResultadoSalud) =>
  ({
    check: jest.fn().mockResolvedValue(resultado),
  }) as unknown as HealthService;

const sano: ResultadoSalud = {
  status: "healthy",
  checks: { database: "up" },
  timestamp: "2026-07-25T00:00:00.000Z",
};

const enfermo: ResultadoSalud = {
  status: "unhealthy",
  checks: { database: "down" },
  timestamp: "2026-07-25T00:00:00.000Z",
};

describe("HealthController", () => {
  it("responde 200 cuando el servicio está sano", async () => {
    const res = respuesta();
    const controller = new HealthController(servicio(sano));

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  // Un 200 con "unhealthy" en el cuerpo dejaría al orquestador enviando tráfico
  // a un servicio que no puede atenderlo: las probes solo miran el código.
  it("responde 503 cuando alguna dependencia está caída", async () => {
    const res = respuesta();
    const controller = new HealthController(servicio(enfermo));

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it("devuelve el detalle de cada dependencia", async () => {
    const controller = new HealthController(servicio(enfermo));

    const resultado = await controller.check(respuesta());

    expect(resultado).toEqual(enfermo);
  });
});
