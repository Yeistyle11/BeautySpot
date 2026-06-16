import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

export interface ServiceUrls {
  auth: string;
  core: string;
  booking: string;
  payment: string;
  notification: string;
  marketplace: string;
  analytics: string;
}

@Injectable()
export class ServiceUrlsConfig {
  private urls: ServiceUrls;

  constructor(private configService: ConfigService) {
    this.urls = {
      auth: this.configService.get("AUTH_SERVICE_URL", "http://localhost:3001"),
      core: this.configService.get("CORE_SERVICE_URL", "http://localhost:3002"),
      booking: this.configService.get("BOOKING_SERVICE_URL", "http://localhost:3003"),
      payment: this.configService.get("PAYMENT_SERVICE_URL", "http://localhost:3004"),
      notification: this.configService.get("NOTIFICATION_SERVICE_URL", "http://localhost:3005"),
      marketplace: this.configService.get("MARKETPLACE_SERVICE_URL", "http://localhost:3006"),
      analytics: this.configService.get("ANALYTICS_SERVICE_URL", "http://localhost:3007"),
    };
  }

  getUrl(service: string): string {
    return this.urls[service as keyof ServiceUrls] || this.urls.core;
  }

  getAll(): ServiceUrls {
    return this.urls;
  }
}
