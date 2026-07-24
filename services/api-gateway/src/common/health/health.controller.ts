import { Controller, Get } from "@nestjs/common";
import { ServiceUrlsConfig } from "../../config/service-urls";

/** Expone /health con el estado agregado del gateway y de cada backend. */
@Controller("health")
export class HealthController {
  constructor(private serviceUrls: ServiceUrlsConfig) {}

  /**
   * Consulta el /health de cada microservicio en paralelo y devuelve "healthy"
   * solo si todos responden; si alguno falla el estado global es "degraded".
   */
  @Get()
  async check() {
    const services = this.serviceUrls.getAll();
    const entries = Object.entries(services);

    const results = await Promise.all(
      entries.map(async ([name, url]): Promise<[string, string]> => {
        try {
          const response = await fetch(`${url}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          return [name, response.ok ? "healthy" : "unhealthy"];
        } catch {
          return [name, "unreachable"];
        }
      })
    );

    const statusMap = Object.fromEntries(results);
    const allHealthy = results.every(([, status]) => status === "healthy");

    return {
      status: allHealthy ? "healthy" : "degraded",
      services: statusMap,
      timestamp: new Date().toISOString(),
    };
  }
}
