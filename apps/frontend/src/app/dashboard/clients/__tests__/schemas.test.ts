import {
  clientSchema,
  campoDeFichaSchema,
  CLIENTS_KEY,
  CLIENT_FIELDS_KEY,
} from "../schemas";

const clienteDeLaApi = {
  id: "9d3f1a2b-6c4e-4f8a-9b1d-2e5c7a0f3b41",
  name: "Juan Pérez",
  email: "juan@example.com",
  phone: "+573001234567",
  loyaltyPoints: 120,
  notes: null,
  active: true,
};

describe("clientSchema", () => {
  it("acepta un cliente sin ficha, que es como llegan los de siempre", () => {
    const parsed = clientSchema.parse(clienteDeLaApi);

    expect(parsed.ficha).toBeUndefined();
  });

  it("conserva los valores de la ficha tal cual, sean del tipo que sean", () => {
    const ficha = { "campo-1": "Látex", "campo-2": 3, "campo-3": true };

    const parsed = clientSchema.parse({ ...clienteDeLaApi, ficha });

    expect(parsed.ficha).toEqual(ficha);
  });

  it("marca al cliente suprimido con su fecha", () => {
    const parsed = clientSchema.parse({
      ...clienteDeLaApi,
      anonymizedAt: "2026-08-09T10:00:00.000Z",
    });

    expect(parsed.anonymizedAt).toBe("2026-08-09T10:00:00.000Z");
  });
});

describe("campoDeFichaSchema", () => {
  const campo = {
    id: "campo-1",
    etiqueta: "Alergias",
    tipo: "texto",
    obligatorio: true,
    orden: 0,
    active: true,
  };

  it("acepta un campo sin opciones ni servicios", () => {
    const parsed = campoDeFichaSchema.parse(campo);

    expect(parsed.serviceIds).toBeUndefined();
  });

  it("rechaza un tipo que la interfaz no sabe pintar", () => {
    expect(() =>
      campoDeFichaSchema.parse({ ...campo, tipo: "firma" })
    ).toThrow();
  });
});

describe("claves de la API", () => {
  it("apuntan a los endpoints del gateway", () => {
    expect(CLIENTS_KEY).toBe("/core/clients");
    expect(CLIENT_FIELDS_KEY).toBe("/core/client-fields");
  });
});
