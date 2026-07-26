import { professionalSchema, toProfessionalPayload } from "../schemas";

/** Profesional tal y como lo devuelve /core/professionals. */
const profesionalDeLaApi = {
  id: "318fb385-3d27-44e0-8dcf-e1ccaa1d28ce",
  name: "Yeison García",
  photo: null,
  bio: "Barbero con más de 2 años de experiencia",
  category: "Barbero",
  categoryId: "129f0032-33ba-470c-81ba-bc8d47abecb6",
  specialties: ["Corte", "Barba"],
  yearsExp: 2,
  rating: 0,
  totalReviews: 0,
  active: true,
};

describe("professionalSchema", () => {
  // La entidad aplica numericTransformer al decimal, así que rating llega como
  // number. Un esquema que espere texto descarta la respuesta entera y la lista
  // se queda vacía aunque los profesionales existan.
  it("acepta el profesional que devuelve la API", () => {
    const result = professionalSchema.safeParse(profesionalDeLaApi);

    expect(result.success).toBe(true);
  });

  it("acepta una valoración con decimales", () => {
    const result = professionalSchema.safeParse({
      ...profesionalDeLaApi,
      rating: 4.5,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza una valoración en texto", () => {
    const result = professionalSchema.safeParse({
      ...profesionalDeLaApi,
      rating: "0.00",
    });

    expect(result.success).toBe(false);
  });

  it("admite los campos opcionales en nulo", () => {
    const result = professionalSchema.safeParse({
      ...profesionalDeLaApi,
      photo: null,
      bio: null,
      category: null,
      categoryId: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("toProfessionalPayload", () => {
  const categorias = [
    { id: "cat-1", name: "Barbero", color: null, active: true },
  ];

  const formulario = {
    name: "Juan",
    bio: "",
    specialties: "Corte, Barba , ",
    yearsExp: "5",
    category: "",
    categoryId: "cat-1",
    photo: "",
    active: "true",
  };

  it("parte las especialidades y descarta las vacías", () => {
    const payload = toProfessionalPayload(formulario, categorias);

    expect(payload.specialties).toEqual(["Corte", "Barba"]);
  });

  // El backend guarda además el nombre de la categoría como texto.
  it("toma el nombre de la categoría elegida", () => {
    const payload = toProfessionalPayload(formulario, categorias);

    expect(payload.category).toBe("Barbero");
    expect(payload.categoryId).toBe("cat-1");
  });

  // Los DTOs rechazan una cadena vacía donde esperan URL o texto opcional.
  it("omite los campos que el formulario deja en blanco", () => {
    const payload = toProfessionalPayload(formulario, categorias);

    expect(payload.bio).toBeUndefined();
    expect(payload.photo).toBeUndefined();
  });

  it("incluye active sólo al editar", () => {
    expect(
      toProfessionalPayload(formulario, categorias).active
    ).toBeUndefined();
    expect(toProfessionalPayload(formulario, categorias, true).active).toBe(
      true
    );
  });
});
