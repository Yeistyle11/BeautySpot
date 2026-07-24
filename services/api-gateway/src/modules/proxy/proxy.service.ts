import { Injectable } from "@nestjs/common";
import { ServiceUrlsConfig } from "../../config/service-urls";

/**
 * Resuelve el nombre de un microservicio a la URL base a la que el gateway
 * debe reenviar la peticion.
 */
@Injectable()
export class ProxyService {
  constructor(private serviceUrls: ServiceUrlsConfig) {}

  /** Devuelve la URL base del microservicio indicado. */
  getServiceUrl(serviceName: string): string {
    const normalized = this.normalize(serviceName);
    return this.serviceUrls.getUrl(normalized);
  }

  /** Indica si el nombre corresponde a un servicio conocido; se usa para rechazar rutas desconocidas. */
  isValidService(serviceName: string): boolean {
    const normalized = this.normalize(serviceName);
    return this.serviceUrls.hasUrl(normalized);
  }

  /** Quita el sufijo "-service" para que "auth-service" y "auth" resuelvan igual. */
  private normalize(serviceName: string): string {
    return serviceName.replace("-service", "");
  }
}
