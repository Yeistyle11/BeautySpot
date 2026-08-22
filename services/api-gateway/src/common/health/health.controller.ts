import { Controller, Get } from "@nestjs/common";
import { Internal } from "@beautyspot/nest-common";
import { ServiceUrlsConfig } from "../../config/service-urls";

/** Estado de un backend visto desde el gateway. */
type EstadoDeServicio = "healthy" | "unhealthy" | "unreachable";

/** Expone /health, con el desglose por servicio detrás del secreto interno. */
@Controller("health")
export class HealthController {
  constructor(private serviceUrls: ServiceUrlsConfig) {}

  /**
   * Salud del conjunto, sin decir quién falla.
   *
   * Es una ruta pública —la consultan el balanceador y el orquestador—, y el
   * desglose por servicio dibuja la topología interna y señala cuál está caído,
   * que es justo lo que busca quien tantea. Para operar está el de abajo.
   */
  @Get()
  async check() {
    const estados = await this.estadoDeCadaServicio();

    return {
      status: this.todosSanos(estados) ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
    };
  }

  /** Igual que el anterior, con el detalle por servicio. Exige el secreto interno. */
  @Internal()
  @Get("detalle")
  async detalle() {
    const estados = await this.estadoDeCadaServicio();

    return {
      status: this.todosSanos(estados) ? "healthy" : "degraded",
      services: Object.fromEntries(estados),
      timestamp: new Date().toISOString(),
    };
  }

  /** Consulta el /health de cada microservicio en paralelo. */
  private async estadoDeCadaServicio(): Promise<
    Array<[string, EstadoDeServicio]>
  > {
    const services = this.serviceUrls.getAll();

    return Promise.all(
      Object.entries(services).map(
        async ([name, url]): Promise<[string, EstadoDeServicio]> => {
          try {
            const response = await fetch(`${url}/health`, {
              signal: AbortSignal.timeout(3000),
            });
            return [name, response.ok ? "healthy" : "unhealthy"];
          } catch {
            return [name, "unreachable"];
          }
        }
      )
    );
  }

  /** Solo está sano si lo están todos. */
  private todosSanos(estados: Array<[string, EstadoDeServicio]>): boolean {
    return estados.every(([, status]) => status === "healthy");
  }
}
