import { emptyForm, serviceSchema, toServicePayload } from "../schemas";

const CATEGORIAS = [
  { id: "cat-1", name: "Coloración", color: null, active: true },
];

const base = { ...emptyForm, name: "Tinte", price: "120000", duration: "90" };

describe("toServicePayload: procesado y limpieza", () => {
  it("manda los campos vacíos como ausentes, no como cero", () => {
    const payload = toServicePayload(base, CATEGORIAS);

    expect(payload.procesadoDesde).toBeUndefined();
    expect(payload.procesadoMinutos).toBeUndefined();
    expect(payload.bufferDespues).toBeUndefined();
  });

  it("manda la ventana de procesado cuando está completa", () => {
    const payload = toServicePayload(
      { ...base, procesadoDesde: "20", procesadoMinutos: "40" },
      CATEGORIAS
    );

    expect(payload).toMatchObject({ procesadoDesde: 20, procesadoMinutos: 40 });
  });

  it("no manda el inicio si falta la duración del hueco", () => {
    // El backend exige la pareja completa.
    const payload = toServicePayload(
      { ...base, procesadoDesde: "20" },
      CATEGORIAS
    );

    expect(payload.procesadoDesde).toBeUndefined();
  });

  it("acepta un hueco que empieza en el minuto cero", () => {
    const payload = toServicePayload(
      { ...base, procesadoDesde: "0", procesadoMinutos: "40" },
      CATEGORIAS
    );

    expect(payload.procesadoDesde).toBe(0);
  });

  it("manda la limpieza cuando se escribe", () => {
    const payload = toServicePayload(
      { ...base, bufferDespues: "10" },
      CATEGORIAS
    );

    expect(payload.bufferDespues).toBe(10);
  });
});

describe("serviceSchema", () => {
  const servicioDeLaApi = {
    id: "svc-1",
    name: "Corte",
    description: null,
    price: 30000,
    duration: 30,
    category: null,
    categoryId: null,
    active: true,
  };

  it("acepta un servicio sin reparto, que es como llegan los de siempre", () => {
    const parsed = serviceSchema.parse(servicioDeLaApi);

    expect(parsed.procesadoDesde).toBeUndefined();
  });

  it("conserva el reparto cuando viene", () => {
    const parsed = serviceSchema.parse({
      ...servicioDeLaApi,
      procesadoDesde: 20,
      procesadoMinutos: 40,
      bufferDespues: 10,
    });

    expect(parsed).toMatchObject({ procesadoDesde: 20, bufferDespues: 10 });
  });
});
