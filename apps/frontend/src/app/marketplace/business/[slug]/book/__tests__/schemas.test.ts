import {
  profileResponseSchema,
  profileSchema,
  serviceSchema,
  professionalSchema,
  generateFallbackSlots,
  BOOKING_STEPS,
} from "../schemas";

/**
 * Respuesta real de GET /marketplace/profiles/:slug. El perfil viene envuelto
 * junto a los profesionales; leerlo plano deja la reserva sin negocio.
 */
const respuestaDeLaApi = {
  profile: {
    id: "1f0a6d55-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
    name: "Salón Aurora",
    slug: "salon-aurora",
    description: "Barbería y salón de belleza en el centro de Medellín.",
    logo: null,
    coverImage: null,
    phone: "+573001112233",
    city: "Medellín",
  },
  professionals: [],
};

describe("profileResponseSchema", () => {
  it("desempaqueta el perfil del sobre { profile, professionals }", () => {
    const respuesta = profileResponseSchema.parse(respuestaDeLaApi);

    expect(respuesta.profile.slug).toBe("salon-aurora");
    expect(respuesta.profile.businessId).toBe(
      "72c9ec5c-4116-4481-9a3b-dad43da27b46"
    );
  });

  it("acepta la respuesta aunque no traiga profesionales", () => {
    const result = profileResponseSchema.safeParse({
      profile: respuestaDeLaApi.profile,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza el perfil plano, sin envolver", () => {
    // La reserva trata un perfil que no parsea como negocio inexistente.
    const result = profileResponseSchema.safeParse(respuestaDeLaApi.profile);

    expect(result.success).toBe(false);
  });

  it("exige el businessId, que es lo que encadena el resto de llamadas", () => {
    const { businessId: _omitido, ...sinBusinessId } = respuestaDeLaApi.profile;

    const result = profileResponseSchema.safeParse({ profile: sinBusinessId });

    expect(result.success).toBe(false);
  });
});

describe("catálogos del flujo de reserva", () => {
  it("acepta los servicios públicos del negocio", () => {
    const servicio = {
      id: "4a28a25f-5168-4d8b-a8fd-51dc5f9f33e6",
      name: "Corte básico",
      price: 30000,
      duration: 30,
    };

    expect(serviceSchema.safeParse(servicio).success).toBe(true);
  });

  it("acepta un profesional sin foto y sin perfil enlazado", () => {
    const profesional = {
      id: "3b2a1c0d-9e8f-4a7b-6c5d-4e3f2a1b0c9d",
      professionalId: null,
      name: "David Arismendy",
      photo: null,
      specialties: ["Corte", "barba"],
    };

    expect(professionalSchema.safeParse(profesional).success).toBe(true);
  });

  it("mantiene el perfil ligero: solo lo que la reserva necesita", () => {
    const result = profileSchema.parse(respuestaDeLaApi.profile);

    expect(Object.keys(result).sort()).toEqual([
      "businessId",
      "id",
      "name",
      "slug",
    ]);
  });
});

describe("horarios de respaldo", () => {
  it("cubre la jornada de 8:00 a 18:00 en tramos de media hora", () => {
    const slots = generateFallbackSlots();

    expect(slots[0]).toBe("08:00");
    expect(slots).toContain("13:30");
    expect(slots[slots.length - 1]).toBe("18:00");
  });

  it("numera los cuatro pasos de la reserva", () => {
    expect(BOOKING_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4]);
  });
});
