import {
  defaultSections,
  profileSchema,
  reorderSections,
  sugerirEnlace,
} from "../schemas";

/** Perfil tal y como lo devuelve GET /marketplace/business-profiles. */
const perfilDeLaApi = {
  id: "bd0a6740-4cb1-42f3-aea5-bb12bd479ecf",
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  slug: "salon-aurora",
  name: "Salón Aurora",
  description: "Barbería y salón de belleza en el centro de Medellín.",
  logo: null,
  coverImage: null,
  phone: "+573001112233",
  email: "hola@salonaurora.co",
  tagline: null,
  storyTitle: null,
  storyText: null,
  storyImage: null,
  foundedYear: null,
  founders: null,
  socialLinks: null,
  sectionConfig: {
    sections: [
      { id: "story", order: 1, enabled: true },
      { id: "services", order: 2, enabled: true },
      { id: "team", order: 3, enabled: true },
      { id: "gallery", order: 4, enabled: true },
      { id: "reviews", order: 5, enabled: true },
      { id: "location", order: 6, enabled: true },
    ],
  },
  galleryImages: null,
  isPublished: true,
  profileCompleteness: 18,
};

describe("profileSchema del panel", () => {
  it("acepta el perfil recien creado, con los opcionales a null", () => {
    const result = profileSchema.safeParse(perfilDeLaApi);

    expect(result.success).toBe(true);
  });

  it("acepta el perfil ya rellenado", () => {
    const result = profileSchema.safeParse({
      ...perfilDeLaApi,
      socialLinks: { instagram: "@salonaurora" },
      galleryImages: [{ url: "https://salonaurora.co/1.jpg" }],
    });

    expect(result.success).toBe(true);
  });
});

describe("secciones del perfil", () => {
  it("las secciones por defecto usan el mismo campo que el backend", () => {
    expect(defaultSections.map((s) => s.id)).toEqual([
      "story",
      "services",
      "team",
      "gallery",
      "reviews",
      "location",
    ]);
  });

  it("reordenar intercambia el orden de dos secciones", () => {
    const movidas = reorderSections(defaultSections, "services", "up");

    expect(movidas.find((s) => s.id === "services")?.order).toBe(1);
    expect(movidas.find((s) => s.id === "story")?.order).toBe(2);
  });
});

describe("sugerirEnlace", () => {
  it("convierte el nombre del negocio en un enlace legible", () => {
    expect(sugerirEnlace("Barbería La Noche")).toBe("barberia-la-noche");
  });

  it("quita tildes, símbolos y espacios de más", () => {
    expect(sugerirEnlace("  Salón  &  Spa Ñandú!! ")).toBe("salon-spa-nandu");
  });

  // El nombre puede no dar ninguna letra utilizable; quien llama tiene que
  // poder detectarlo para pedir el enlace a mano.
  it("devuelve vacío si el nombre no deja nada aprovechable", () => {
    expect(sugerirEnlace("%%%")).toBe("");
  });

  it("no pasa del largo que admite la columna", () => {
    expect(sugerirEnlace("a".repeat(200))).toHaveLength(100);
  });
});
