import {
  esIdentificadorInvalido,
  esViolacionDeCatalogo,
} from "./errores-de-postgres";

describe("esIdentificadorInvalido", () => {
  it("reconoce el 22P02 de Postgres", () => {
    expect(esIdentificadorInvalido({ code: "22P02" })).toBe(true);
  });

  it("deja pasar cualquier otro error de la base", () => {
    expect(esIdentificadorInvalido({ code: "23505" })).toBe(false);
  });

  it("no se rompe con lo que no es un error de Postgres", () => {
    expect(esIdentificadorInvalido(new Error("boom"))).toBe(false);
    expect(esIdentificadorInvalido(null)).toBe(false);
    expect(esIdentificadorInvalido("22P02")).toBe(false);
  });
});

describe("esViolacionDeCatalogo", () => {
  it("reconoce el 23514 de Postgres", () => {
    expect(esViolacionDeCatalogo({ code: "23514" })).toBe(true);
  });

  it("deja pasar cualquier otro error de la base", () => {
    expect(esViolacionDeCatalogo({ code: "22P02" })).toBe(false);
  });

  it("deja ver que restriccion se toco", () => {
    const error = { code: "23514", constraint: "CHK_payments_method" };
    if (!esViolacionDeCatalogo(error)) throw new Error("deberia reconocerlo");
    expect(error.constraint).toBe("CHK_payments_method");
  });

  it("no se rompe con lo que no es un error de Postgres", () => {
    expect(esViolacionDeCatalogo(undefined)).toBe(false);
  });
});
