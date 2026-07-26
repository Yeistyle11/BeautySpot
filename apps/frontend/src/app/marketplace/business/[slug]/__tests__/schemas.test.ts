import { profileResponseSchema } from "../schemas";

/** Respuesta de GET /marketplace/profiles/:slug. */
const respuestaDeLaApi = {
  profile: {
    id: "bd0a6740-4cb1-42f3-aea5-bb12bd479ecf",
    businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
    slug: "salon-aurora",
    name: "Salón Aurora",
    description: "Barbería y salón de belleza en el centro de Medellín.",
    logo: null,
    coverImage: null,
    phone: "+573001112233",
    email: "hola@salonaurora.co",
    address: "Calle 10 #43-25",
    city: "Medellín",
    state: "Antioquia",
    country: "CO",
    lat: null,
    lng: null,
    rating: 0,
    totalReviews: 0,
    businessType: "SALON",
    active: true,
    verified: false,
    tagline: null,
    storyTitle: null,
    storyText: null,
    storyImage: null,
    foundedYear: null,
    founders: null,
    socialLinks: null,
    sectionConfig: { sections: [] },
    galleryImages: null,
    isPublished: true,
    profileCompleteness: 18,
  },
  professionals: [],
};

describe("profileResponseSchema", () => {
  it("acepta la respuesta que devuelve la API", () => {
    const result = profileResponseSchema.safeParse(respuestaDeLaApi);

    expect(result.success).toBe(true);
  });

  it("acepta la respuesta sin el equipo", () => {
    const { profile } = respuestaDeLaApi;

    const result = profileResponseSchema.safeParse({ profile });

    expect(result.success).toBe(true);
  });

  it("rechaza el perfil suelto, sin envolver", () => {
    const result = profileResponseSchema.safeParse(respuestaDeLaApi.profile);

    expect(result.success).toBe(false);
  });
});
