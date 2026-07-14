import { Injectable } from "@nestjs/common";
import { ServiceUrlsConfig } from "../../config/service-urls";

@Injectable()
export class ProxyService {
  constructor(private serviceUrls: ServiceUrlsConfig) {}

  getServiceUrl(serviceName: string): string {
    const normalized = this.normalize(serviceName);
    return this.serviceUrls.getUrl(normalized);
  }

  isValidService(serviceName: string): boolean {
    const normalized = this.normalize(serviceName);
    return this.serviceUrls.hasUrl(normalized);
  }

  private normalize(serviceName: string): string {
    return serviceName.replace("-service", "");
  }
}
