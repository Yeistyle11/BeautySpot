import { esViolacionDeUnicidad } from "./violacion-de-unicidad";

describe("esViolacionDeUnicidad", () => {
  it("reconoce el 23505 de Postgres", () => {
    expect(esViolacionDeUnicidad({ code: "23505" })).toBe(true);
  });

  it("deja pasar cualquier otro error de la base", () => {
    expect(esViolacionDeUnicidad({ code: "23503" })).toBe(false);
  });

  it("no se rompe con lo que no es un error de Postgres", () => {
    expect(esViolacionDeUnicidad(new Error("boom"))).toBe(false);
    expect(esViolacionDeUnicidad(null)).toBe(false);
    expect(esViolacionDeUnicidad("23505")).toBe(false);
  });

  it("deja ver que índice se tocó", () => {
    const error = { code: "23505", constraint: "uq_payments_cita_viva" };
    if (!esViolacionDeUnicidad(error)) throw new Error("debería reconocerlo");
    expect(error.constraint).toBe("uq_payments_cita_viva");
  });
});
