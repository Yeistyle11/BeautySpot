import { Injectable } from "@nestjs/common";
import { InternalHttpClient } from "@beautyspot/nest-common";

/** Datos legibles de los participantes de una cita, listos para plantillas de correo. */
export interface EnrichedProfileData {
  clientName: string;
  clientEmail: string;
  /** Cuenta del cliente, o null si reservó como invitado sin registrarse. */
  clientUserId: string | null;
  professionalName: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
}

/** Respuesta cruda del core al resolver ids a nombres; cada campo es null si no se pudo. */
interface ProfileResolution {
  client: { name: string; email: string; userId?: string | null } | null;
  professional: { name: string } | null;
  business: { name: string; address: string; phone: string } | null;
}

/** Valores por defecto cuando el core no puede resolver un perfil, para no romper el correo. */
const FALLBACK = {
  clientName: "Cliente",
  clientEmail: "",
  clientUserId: null,
  professionalName: "Profesional",
  businessName: "BeautySpot",
  businessAddress: "",
  businessPhone: "",
};

/**
 * Traduce los ids de una cita (cliente, profesional, negocio) a nombres y datos
 * de contacto consultando al core-service, con valores por defecto ante fallos.
 */
@Injectable()
export class DataEnricherService {
  constructor(private readonly http: InternalHttpClient) {}

  /** Devuelve los datos legibles de los tres participantes de una cita. */
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
      clientUserId: resolution.client?.userId ?? FALLBACK.clientUserId,
      professionalName:
        resolution.professional?.name ?? FALLBACK.professionalName,
      businessName: resolution.business?.name ?? FALLBACK.businessName,
      businessAddress: resolution.business?.address ?? FALLBACK.businessAddress,
      businessPhone: resolution.business?.phone ?? FALLBACK.businessPhone,
    };
  }

  /** Devuelve el email de un cliente, o cadena vacía si no se pudo resolver. */
  async enrichClientEmail(clientId: string): Promise<string> {
    const resolution = await this.resolveProfiles({ clientId });
    return resolution.client?.email ?? "";
  }

  /** Devuelve el nombre y datos de contacto de un negocio. */
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

  /** Llama al endpoint interno del core para resolver los ids indicados; devuelve nulls ante error. */
  private async resolveProfiles(ids: {
    clientId?: string;
    professionalId?: string;
    businessId?: string;
  }): Promise<ProfileResolution> {
    const params = new URLSearchParams();
    if (ids.clientId) params.set("clientId", ids.clientId);
    if (ids.professionalId) params.set("professionalId", ids.professionalId);
    if (ids.businessId) params.set("businessId", ids.businessId);

    // Fail-open a propósito: los datos con que se adorna un correo no valen
    // como para dejar de enviarlo. Si core no responde, se usan los de reserva.
    const resolucion = await this.http.pedirONulo<ProfileResolution>(
      "core",
      `/internal/profiles/resolve?${params}`
    );

    return resolucion ?? { client: null, professional: null, business: null };
  }
}
