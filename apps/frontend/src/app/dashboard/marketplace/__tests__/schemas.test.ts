import { profileSchema } from "../schemas";

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
  sectionConfig: { sections: [] },
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
