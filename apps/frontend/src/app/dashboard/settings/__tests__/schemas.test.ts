import { businessDataSchema, businessHourSchema } from "../schemas";

/** Negocio tal y como lo devuelve /core/businesses/:id. */
const negocioDeLaApi = {
  id: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  slug: "salon-aurora",
  name: "Salón Aurora",
  description: "Barbería y salón de belleza en el centro de Medellín.",
  logo: null,
  coverImage: null,
  phone: "+573001112233",
  email: "hola@salonaurora.co",
  website: null,
  address: "Calle 10 #43-25",
  city: "Medellín",
  state: "Antioquia",
  country: "CO",
  businessType: "SALON",
  active: true,
  verified: true,
};

describe("businessDataSchema", () => {
  // Las columnas sin rellenar llegan como null. Un esquema que sólo admita la
  // ausencia descarta la respuesta y la pestaña se queda cargando para siempre.
  it("acepta el negocio que devuelve la API, con nulos incluidos", () => {
    const result = businessDataSchema.safeParse(negocioDeLaApi);

    expect(result.success).toBe(true);
  });

  it("acepta que los campos opcionales lleguen con valor", () => {
    const result = businessDataSchema.safeParse({
      ...negocioDeLaApi,
      logo: "https://cdn.example.com/logo.png",
      website: "https://salonaurora.co",
    });

    expect(result.success).toBe(true);
  });

  it("acepta que los campos opcionales no vengan", () => {
    const result = businessDataSchema.safeParse({
      id: negocioDeLaApi.id,
      name: negocioDeLaApi.name,
    });

    expect(result.success).toBe(true);
  });

  it("sigue exigiendo id y nombre", () => {
    expect(businessDataSchema.safeParse({ name: "Sin id" }).success).toBe(
      false
    );
    expect(businessDataSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("businessHourSchema", () => {
  it("acepta un horario del backend", () => {
    const result = businessHourSchema.safeParse({
      id: "h1",
      dayOfWeek: 1,
      openTime: "09:00",
      closeTime: "18:00",
      active: true,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un día que no es número", () => {
    const result = businessHourSchema.safeParse({
      dayOfWeek: "lunes",
      openTime: "09:00",
      closeTime: "18:00",
      active: true,
    });

    expect(result.success).toBe(false);
  });
});
