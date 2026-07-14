import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface EnrichedProfileData {
  clientName: string;
  clientEmail: string;
  professionalName: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
}

interface ProfileResolution {
  client: { name: string; email: string } | null;
  professional: { name: string } | null;
  business: { name: string; address: string; phone: string } | null;
}

const FALLBACK = {
  clientName: "Cliente",
  clientEmail: "",
  professionalName: "Profesional",
  businessName: "BeautySpot",
  businessAddress: "",
  businessPhone: "",
};

@Injectable()
export class DataEnricherService {
  private readonly logger = new Logger(DataEnricherService.name);

  constructor(private readonly configService: ConfigService) {}

  async enrichAppointmentParticipants(
    clientId: string,
    professionalId: string,
    businessId: string
  ): Promise<EnrichedProfileData> {
    const resolution = await this.resolveProfiles({
      clientId,
      professionalId,
      businessId,
    });

    return {
      clientName: resolution.client?.name ?? FALLBACK.clientName,
      clientEmail: resolution.client?.email ?? FALLBACK.clientEmail,
      professionalName:
        resolution.professional?.name ?? FALLBACK.professionalName,
      businessName: resolution.business?.name ?? FALLBACK.businessName,
      businessAddress: resolution.business?.address ?? FALLBACK.businessAddress,
      businessPhone: resolution.business?.phone ?? FALLBACK.businessPhone,
    };
  }

  async enrichClientEmail(clientId: string): Promise<string> {
    const resolution = await this.resolveProfiles({ clientId });
    return resolution.client?.email ?? "";
  }

  async enrichBusinessData(businessId: string): Promise<{
    businessName: string;
    businessAddress: string;
    businessPhone: string;
  }> {
    const resolution = await this.resolveProfiles({ businessId });
    return {
      businessName: resolution.business?.name ?? FALLBACK.businessName,
      businessAddress: resolution.business?.address ?? FALLBACK.businessAddress,
      businessPhone: resolution.business?.phone ?? FALLBACK.businessPhone,
    };
  }

  private async resolveProfiles(ids: {
    clientId?: string;
    professionalId?: string;
    businessId?: string;
  }): Promise<ProfileResolution> {
    const coreServiceUrl = this.configService.get<string>(
      "CORE_SERVICE_URL",
      "http://localhost:3002"
    );
    const internalSecret = this.configService.get<string>(
      "INTERNAL_API_SECRET",
      ""
    );

    const params = new URLSearchParams();
    if (ids.clientId) params.set("clientId", ids.clientId);
    if (ids.professionalId) params.set("professionalId", ids.professionalId);
    if (ids.businessId) params.set("businessId", ids.businessId);

    const url = `${coreServiceUrl}/internal/profiles/resolve?${params}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-internal-secret": internalSecret,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn(
          `core-service respondió ${response.status} al resolver perfiles`
        );
        return { client: null, professional: null, business: null };
      }

      return (await response.json()) as ProfileResolution;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudieron resolver perfiles: ${msg}`);
      return { client: null, professional: null, business: null };
    }
  }
}
