import {
  profileResponseSchema,
  servicioPublicoSchema,
  profesionalPublicoSchema,
} from "../schemas";

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

/**
 * Los servicios y el equipo del perfil publico salen de los endpoints publicos
 * del core, no del escaparate del marketplace, asi que su contrato se valida
 * aqui aparte del perfil.
 */
describe("servicioPublicoSchema", () => {
  const servicio = {
    id: "7a9f0d5e-1b2c-4d3e-8f90-1a2b3c4d5e6f",
    name: "Corte basico",
    description: "Corte de cabello con maquina y tijera.",
    category: "Barberia",
    price: 25000,
    duration: 30,
  };

  it("acepta un servicio completo", () => {
    expect(servicioPublicoSchema.safeParse(servicio).success).toBe(true);
  });

  // La descripcion y la categoria son opcionales al crear el servicio, asi que
  // el escaparate tiene que saber pintarlas vacias.
  it("acepta un servicio sin descripcion ni categoria", () => {
    const { description: _d, category: _c, ...minimo } = servicio;

    expect(servicioPublicoSchema.safeParse(minimo).success).toBe(true);
  });

  it("rechaza un precio que llega como texto", () => {
    expect(
      servicioPublicoSchema.safeParse({ ...servicio, price: "25000" }).success
    ).toBe(false);
  });
});

describe("profesionalPublicoSchema", () => {
  const profesional = {
    id: "3c4d5e6f-7a8b-49c0-b1d2-e3f4a5b6c7d8",
    name: "Ana Ramirez",
    photo: null,
    bio: null,
    specialties: ["Color", "Corte"],
    yearsExp: 5,
    rating: 4.8,
    totalReviews: 12,
  };

  it("acepta la ficha que devuelve el core", () => {
    expect(profesionalPublicoSchema.safeParse(profesional).success).toBe(true);
  });

  // El core solo selecciona algunas columnas; las que el profesional no ha
  // rellenado pueden no venir en absoluto.
  it("acepta una ficha con solo el nombre y el identificador", () => {
    const result = profesionalPublicoSchema.safeParse({
      id: profesional.id,
      name: profesional.name,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza una ficha sin nombre", () => {
    const { name: _n, ...sinNombre } = profesional;

    expect(profesionalPublicoSchema.safeParse(sinNombre).success).toBe(false);
  });
});
