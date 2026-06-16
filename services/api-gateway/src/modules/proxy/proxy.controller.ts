import { Controller, All, Req, Res, Param, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";
import { ProxyService } from "./proxy.service";
import { CircuitBreakerService } from "../circuit-breaker/circuit-breaker.service";
import { PROXY_TIMEOUT_MS } from "@beautyspot/shared-constants";

@Controller("api/v1")
export class ProxyController {
  constructor(
    private proxyService: ProxyService,
    private circuitBreaker: CircuitBreakerService,
  ) {}

  @All(":service/*")
  async proxyRequest(
    @Param("service") service: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.proxyService.isValidService(service)) {
      throw new HttpException(`Servicio "${service}" no encontrado`, HttpStatus.NOT_FOUND);
    }

    return this.circuitBreaker.execute(
      service,
      async () => this.proxiedRequest(service, req, res)
    );
  }

  private async proxiedRequest(
    service: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const serviceUrl = this.proxyService.getServiceUrl(service);
    let path = req.path;
    
    if (path.startsWith("/api/v1/")) {
      path = path.replace(`/api/v1/${service}`, "");
      if (service.endsWith("-service")) {
        const moduleName = service.replace("-service", "");
        path = `/${moduleName}${path}`;
      }
    } else if (path.startsWith("/v1/")) {
      path = path.replace(`/v1/${service}`, "");
      if (service.endsWith("-service")) {
        const moduleName = service.replace("-service", "");
        path = `/${moduleName}${path}`;
      }
    }
    
    const targetUrl = `${serviceUrl}${path}`;

    const headers: Record<string, string> = {};
    if (req.headers["authorization"]) headers["authorization"] = req.headers["authorization"];

    // El X-Business-Id se deriva SIEMPRE del JWT (no del header del cliente)
    // para evitar que un usuario acceda a datos de otro negocio (cross-tenant).
    const user = (req as any).user;
    if (user?.businessId) {
      headers["x-business-id"] = user.businessId;
    } else if (user?.businessIds?.length) {
      headers["x-business-id"] = user.businessIds[0];
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      headers["content-type"] = "application/json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === "AbortError") {
        throw new HttpException(
          `Servicio ${service} excedió el tiempo límite`,
          HttpStatus.GATEWAY_TIMEOUT
        );
      }

      throw new HttpException(
        `Servicio ${service} no disponible`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}