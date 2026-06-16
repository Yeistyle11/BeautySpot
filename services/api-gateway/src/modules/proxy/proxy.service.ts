import { Injectable } from "@nestjs/common";
import { ServiceUrlsConfig } from "../../config/service-urls";

@Injectable()
export class ProxyService {
  constructor(private serviceUrls: ServiceUrlsConfig) {}

  getServiceUrl(serviceName: string): string {
    const normalized = serviceName.replace("-service", "");
    return this.serviceUrls.getUrl(normalized);
  }

  isValidService(serviceName: string): boolean {
    const normalized = serviceName.replace("-service", "");
    const validServices = ["auth", "core", "booking", "payment", "notification", "marketplace", "analytics"];
    return validServices.includes(normalized);
  }
}
